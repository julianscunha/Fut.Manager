# .DEPLOY.md — Guia de Deploy "Racha do Fofim" para Render + Supabase

Este documento descreve a arquitetura de produção já implementada no repositório (Postgres + Storage via Supabase, autenticação própria com bcrypt + JWT, hospedagem no Render) e o roteiro para colocar o app no ar.

**Status**: a migração de código já está feita e testada de ponta a ponta contra um projeto Supabase real (login, CRUD de jogadores, upload de imagem, build de produção). O que falta é você provisionar seu próprio projeto Supabase (se ainda não tiver) e fazer o deploy no Render.

---

## Parte 1: Preparação e Setup Supabase

### Passo 1.1: Criar projeto Supabase

1. Acesse [https://supabase.com](https://supabase.com) e faça login (ou crie uma conta gratuita).
2. Clique em **"New project"**.
3. Preencha:
   - **Project name**: `racha-do-fofim` (ou nome à sua escolha)
   - **Database password**: gere uma senha forte (usada só internamente pelo Supabase; você não vai precisar dela diretamente, já que o app fala com o Supabase via API/service role, não via conexão Postgres direta)
   - **Region**: a mais próxima (ex: `South America (São Paulo)`)
   - **Pricing plan**: Free
4. Clique em **"Create new project"** e aguarde ~2 minutos.
5. Em **Settings → API**, guarde:
   - **Project URL** (ex: `https://xxxxxxxxxxxxx.supabase.co`) → vai virar `SUPABASE_URL`
   - **Service Role Secret** → vai virar `SUPABASE_SERVICE_ROLE_KEY` (nunca exponha essa chave ao frontend; ela ignora qualquer regra de acesso do banco)

### Passo 1.2: Criar Storage bucket para uploads

1. No dashboard, clique em **"Storage"** (aba esquerda).
2. Clique em **"Create a new bucket"**.
3. Preencha:
   - **Bucket name**: `Uploads` (exatamente assim, com U maiúsculo — o nome é case-sensitive e precisa bater com `supabase.storage.from('Uploads')` em `server.ts`)
   - **Public bucket**: ✅ **Sim** (as URLs de foto/mídia geradas precisam ser públicas)
4. Clique em **"Create bucket"**.

> Este projeto **não usa o Supabase Auth hospedado** (o sistema de login com usuários/UUID próprios do Supabase). A autenticação é feita por conta própria (bcrypt + JWT — ver Parte 4), para preservar o esquema de IDs `TEXT` (`user-admin`, `player-admin`, etc.) que o app já usa em todo lugar. Não há nenhum passo de "Habilitar Auth" a fazer no dashboard do Supabase.

---

## Parte 2: Criar o Schema Postgres

### Passo 2.1: Abrir SQL Editor do Supabase

No dashboard, clique em **"SQL Editor"** → **"New query"**.

### Passo 2.2: Criar as tabelas

Este schema espelha campo a campo as interfaces em `src/types.ts`. Cole e rode no SQL Editor:

```sql
-- Tabela de usuários (acesso ao sistema)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'auxiliar', 'jogador')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  player_id TEXT,
  athlete_id TEXT
);

-- Tabela de senhas (hash bcrypt — nunca texto puro) e tokens de reset
CREATE TABLE passwords (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  reset_token TEXT,
  reset_token_expires_at TEXT
);

-- Tabela de jogadores (atletas do racha)
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  photo_original TEXT,
  player_card_url TEXT,
  favorite_team_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('mensalista', 'reserva')),
  status TEXT NOT NULL CHECK (status IN ('disponivel', 'indisponivel', 'lesionado', 'afastado')),
  status_start_date TEXT,
  status_end_date TEXT,
  primary_position TEXT NOT NULL CHECK (primary_position IN ('goleiro', 'zagueiro', 'volante', 'meio_campo', 'atacante')),
  secondary_positions TEXT[],
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  current_streak INTEGER,
  max_streak INTEGER,
  admin_notes TEXT,
  time_do_coracao TEXT,
  numero_favorito INTEGER,
  pe_dominante TEXT,
  avatar_original TEXT,
  avatar_esportivo TEXT,
  avatar_card TEXT,
  avatar_status TEXT CHECK (avatar_status IN ('PENDENTE', 'PROCESSANDO', 'CONCLUÍDO', 'ERRO')),
  avatar_version INTEGER
);

-- Tabela de temporadas
CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  active BOOLEAN DEFAULT FALSE
);

-- Tabela de partidas
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  season_id TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  location TEXT,
  duration_minutes INTEGER,
  status TEXT NOT NULL CHECK (status IN ('agendada', 'confirmando', 'aguardando_reservas', 'fechada', 'sorteada', 'encerrada', 'cancelada')),
  lifecycle_state TEXT CHECK (lifecycle_state IN ('SCHEDULED', 'CHECKIN_OPEN', 'CHECKIN_CLOSED', 'DRAW_COMPLETED', 'MATCH_FINISHED', 'ARCHIVED')),
  confirmation_deadline_days_before INTEGER,
  reserves_released BOOLEAN,
  reserves_released_at TEXT,
  evaluations_released BOOLEAN,
  max_players INTEGER
);

-- Tabela de presenças/confirmações
CREATE TABLE presences (
  id TEXT PRIMARY KEY,
  match_id TEXT,
  player_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('confirmado', 'nao_confirmado', 'cancelado')),
  confirmed_at TEXT,
  manually_approved BOOLEAN
);

-- Tabela de transições de categoria (mensalista <-> reserva)
CREATE TABLE category_transitions (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  player_name TEXT,
  previous_category TEXT CHECK (previous_category IN ('mensalista', 'reserva')),
  new_category TEXT CHECK (new_category IN ('mensalista', 'reserva')),
  date TEXT NOT NULL,
  responsible_name TEXT
);

-- Tabela de sorteios de times (teams é um array de {name, captainPlayerId, playerIds} como JSON)
CREATE TABLE draws (
  id TEXT PRIMARY KEY,
  match_id TEXT,
  date TEXT NOT NULL,
  teams JSONB NOT NULL,
  overall_blue DOUBLE PRECISION,
  overall_red DOUBLE PRECISION,
  overall_green DOUBLE PRECISION,
  max_difference DOUBLE PRECISION,
  is_shared_goalkeepers BOOLEAN DEFAULT FALSE,
  captains_configured BOOLEAN DEFAULT FALSE,
  affinities_recorded BOOLEAN DEFAULT FALSE,
  wins_recorded BOOLEAN DEFAULT FALSE,
  redraw_count INTEGER
);

-- Tabela de afinidades de duplas (sem id — chave composta, igual ao tipo DuoAffinity)
CREATE TABLE duo_affinities (
  player_a_id TEXT,
  player_b_id TEXT,
  count INTEGER DEFAULT 0,
  wins_count INTEGER DEFAULT 0,
  PRIMARY KEY (player_a_id, player_b_id)
);

-- Tabela de afinidades de trios (sem id — chave composta, igual ao tipo TrioAffinity)
CREATE TABLE trio_affinities (
  player_a_id TEXT,
  player_b_id TEXT,
  player_c_id TEXT,
  count INTEGER DEFAULT 0,
  wins_count INTEGER DEFAULT 0,
  PRIMARY KEY (player_a_id, player_b_id, player_c_id)
);

-- Tabela de resultados de partidas
CREATE TABLE results (
  id TEXT PRIMARY KEY,
  match_id TEXT,
  season_id TEXT,
  date TEXT NOT NULL,
  wins_blue INTEGER DEFAULT 0,
  wins_red INTEGER DEFAULT 0,
  wins_green INTEGER DEFAULT 0,
  champions TEXT[],
  teams JSONB NOT NULL,
  is_shared_goalkeepers BOOLEAN DEFAULT FALSE
);

-- Tabela de avaliações técnicas de jogadores
CREATE TABLE player_evaluations (
  id TEXT PRIMARY KEY,
  evaluator_user_id TEXT,
  target_player_id TEXT,
  date TEXT NOT NULL,
  ratings JSONB -- { "defesa": 7, "passe": 8, ... }
);

-- Tabela de histórico de Overall (sem id no tipo original; id aqui é só chave técnica)
CREATE TABLE player_history (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  date TEXT NOT NULL,
  overall DOUBLE PRECISION
);

-- Tabela de configuração recorrente (singleton — sempre 1 linha; id é só chave técnica)
CREATE TABLE recurrent_config (
  id TEXT PRIMARY KEY,
  day_of_week INTEGER,
  time TEXT,
  location TEXT,
  duration_minutes INTEGER,
  confirmation_deadline_days_before INTEGER,
  active BOOLEAN DEFAULT TRUE,
  monthly_fee DOUBLE PRECISION,
  charge_date_rule TEXT CHECK (charge_date_rule IN ('primeiro_jogo', 'ultimo_jogo')),
  max_mensalistas INTEGER
);

-- Tabela de alertas de fila de reservas
CREATE TABLE reserve_queue_alerts (
  id TEXT PRIMARY KEY,
  match_id TEXT,
  cancelled_player_id TEXT,
  suggested_reserve_player_id TEXT,
  player_id TEXT,
  status TEXT,
  created_at TEXT NOT NULL,
  cleared BOOLEAN DEFAULT FALSE
);

-- Tabela de ordem de reservas (representação relacional do array reservesOrder: string[])
CREATE TABLE reserves_order (
  player_id TEXT PRIMARY KEY,
  position INTEGER NOT NULL
);

-- Tabela de faturas (mensalidades)
CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  competence TEXT NOT NULL, -- ex: "06/2026"
  amount DOUBLE PRECISION NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'pago')),
  paid_at TEXT
);

-- Tabela de pagamentos
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  bill_id TEXT,
  amount DOUBLE PRECISION NOT NULL,
  paid_at TEXT NOT NULL
);

-- Tabela de configurações de competência (histórico mensal de cobrança)
CREATE TABLE competences (
  competence TEXT PRIMARY KEY, -- ex: "06/2026"
  monthly_fee DOUBLE PRECISION,
  charge_date_rule TEXT CHECK (charge_date_rule IN ('primeiro_jogo', 'ultimo_jogo')),
  generated BOOLEAN DEFAULT FALSE,
  generated_date TEXT
);

-- Tabela de configuração financeira (singleton — sempre 1 linha; id é só chave técnica; history é JSONB de FinanceHistoryEntry[])
CREATE TABLE finance_config (
  id TEXT PRIMARY KEY,
  monthly_fee DOUBLE PRECISION,
  charge_date_rule TEXT CHECK (charge_date_rule IN ('primeiro_jogo', 'ultimo_jogo')),
  history JSONB DEFAULT '[]'::jsonb,
  max_mensalistas INTEGER
);

-- Tabela de eventos sociais (churrascos, etc.)
CREATE TABLE eventos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('churrasco', 'confraternizacao', 'festa', 'viagem', 'personalizado')),
  date TEXT NOT NULL,
  time TEXT,
  location TEXT,
  adult_price DOUBLE PRECISION,
  child_price DOUBLE PRECISION,
  status TEXT NOT NULL CHECK (status IN ('agendado', 'confirmando', 'encerrado', 'cancelado')),
  created_at TEXT NOT NULL
);

-- Tabela de participantes de eventos
CREATE TABLE event_participants (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  player_id TEXT,
  adults_count INTEGER DEFAULT 0,
  children_count INTEGER DEFAULT 0,
  confirmed_at TEXT NOT NULL
);

-- Tabela de faturas de eventos
CREATE TABLE event_bills (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  player_id TEXT,
  amount DOUBLE PRECISION,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'pago')),
  paid_at TEXT
);

-- Tabela de postagens do mural
CREATE TABLE mural_posts (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  file_size INTEGER,
  category TEXT CHECK (category IN ('partida', 'evento', 'resenha', 'livre', 'regra', 'aviso', 'comunicado')),
  author_id TEXT,
  author_name TEXT,
  author_role TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  match_id TEXT,
  event_id TEXT,
  is_highlighted BOOLEAN DEFAULT FALSE,
  highlighted_at TEXT,
  allow_public_view BOOLEAN DEFAULT FALSE,
  show_on_landing BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  medium_url TEXT,
  event_date TEXT,
  origin TEXT CHECK (origin IN ('manual', 'automatic')),
  display_order INTEGER, -- campo "order" no TS; renomeado pois ORDER é palavra reservada do Postgres
  start_date TEXT,
  expiration_date TEXT,
  priority TEXT CHECK (priority IN ('alta', 'media', 'baixa')),
  is_archived BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Tabela de categorias do mural (id é o próprio valor da categoria)
CREATE TABLE mural_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Tabela de destaques do mural (histórico de quem destacou o quê)
CREATE TABLE mural_highlights (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  highlighted_by TEXT,
  highlighted_at TEXT NOT NULL
);

-- Tabela de arquivos do mural
CREATE TABLE mural_files (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  s3_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  size INTEGER,
  original_name TEXT,
  mime_type TEXT,
  uploaded_at TEXT NOT NULL
);

-- Tabela de notificações
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('sistema', 'partida', 'sorteio', 'financeiro', 'evento', 'jogador')),
  title TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('lida', 'nao_lida')),
  created_at TEXT NOT NULL,
  target_user_id TEXT, -- 'all' (todos) ou id de um usuário específico — por isso não é FK
  action_url TEXT,
  match_id TEXT,
  event_id TEXT
);

-- Tabela de preferências de notificação (sem id — chave é user_id, igual ao tipo NotificationPreferences)
-- Nota: o campo "all" do TS virou "all_enabled" aqui porque ALL é palavra reservada do PostgreSQL.
CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY,
  all_enabled BOOLEAN DEFAULT TRUE,
  partidas BOOLEAN DEFAULT TRUE,
  eventos BOOLEAN DEFAULT TRUE,
  financeiro BOOLEAN DEFAULT TRUE,
  sistema BOOLEAN DEFAULT TRUE
);

-- Tabelas "blob": user_audits, deadline_audits e snapshots são `any[]` no TS e construídas
-- com campos diferentes em dezenas de call sites em server.ts (sem um shape fixo/estrito).
-- Em vez de adivinhar colunas, guardamos o objeto inteiro como JSONB e extraímos só o id.
CREATE TABLE user_audits (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE deadline_audits (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Índices para performance
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_players_deleted_at ON players(deleted_at);
CREATE INDEX idx_presences_match_id ON presences(match_id);
CREATE INDEX idx_presences_player_id ON presences(player_id);
CREATE INDEX idx_matches_season_id ON matches(season_id);
CREATE INDEX idx_bills_player_id ON bills(player_id);
CREATE INDEX idx_mural_posts_created_at ON mural_posts(created_at DESC);
CREATE INDEX idx_notifications_target_user_id ON notifications(target_user_id);
```

Clique em **"Run"**.

> **Por que sem `REFERENCES` (foreign keys)?** O app original (JSON) nunca teve integridade referencial no banco — é toda gerenciada em código. Manter esse mesmo modelo no Postgres permite que `server/db.ts` escreva cada tabela de forma independente (apagar linhas removidas + upsert das atuais) sem se preocupar com ordem de dependências entre tabelas.
>
> **Por que `DOUBLE PRECISION`/`INTEGER` em vez de `NUMERIC`/`DECIMAL`?** O Supabase (via PostgREST) devolve colunas `NUMERIC` como **string** em JSON, o que quebraria silenciosamente somas no código (`amount + amount` viraria concatenação de string).
>
> **Por que `TEXT` em vez de `DATE`/`TIMESTAMP`?** Preserva exatamente o formato de string que o app já gera (`YYYY-MM-DD`, `HH:MM`, ISO 8601), evitando divergência entre o que foi salvo e o que volta na leitura.

### Passo 2.3: Criar admin padrão e dados iniciais

```sql
-- Extensão necessária para gerar hash bcrypt direto no SQL (usada abaixo em crypt())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Inserir admin padrão
INSERT INTO users (id, name, email, role, status, created_at, player_id, athlete_id)
VALUES (
  'user-admin',
  'Administrador do Fofim',
  'admin@racha.com',
  'admin',
  'approved',
  NOW()::text,
  'player-admin',
  'player-admin'
);

-- Inserir senha padrão do admin já em hash bcrypt (senha real: "admin" — troque depois do primeiro login)
INSERT INTO passwords (user_id, password_hash)
VALUES ('user-admin', crypt('admin', gen_salt('bf')));

-- Inserir jogador admin
INSERT INTO players (
  id, name, email, phone, photo_original, player_card_url, favorite_team_id,
  category, status, primary_position, secondary_positions, created_at, updated_at
) VALUES (
  'player-admin',
  'Administrador do Fofim',
  'admin@racha.com',
  '(85) 99999-9999',
  '',
  '',
  'out',
  'mensalista',
  'disponivel',
  'meio_campo',
  '{}',
  NOW()::text,
  NOW()::text
);

-- Inserir temporada padrão
INSERT INTO seasons (id, name, year, start_date, end_date, active)
VALUES ('season-2026', 'Temporada 2026', 2026, '2026-01-01', '2026-12-31', true);

-- Inserir configuração recorrente padrão
INSERT INTO recurrent_config (
  id, day_of_week, time, location, duration_minutes,
  confirmation_deadline_days_before, active, monthly_fee, charge_date_rule
) VALUES ('config-default', 6, '21:30', 'Arena Furacão', 60, 2, true, 100, 'primeiro_jogo');

-- Inserir configuração financeira padrão
INSERT INTO finance_config (id, monthly_fee, charge_date_rule, history)
VALUES ('finance-default', 100, 'primeiro_jogo', '[]'::jsonb);

-- Inserir categorias padrão do mural
INSERT INTO mural_categories (id, name) VALUES
  ('partida', 'Partida'), ('evento', 'Evento'), ('resenha', 'Resenha'),
  ('livre', 'Livre'), ('regra', 'Regra'), ('aviso', 'Aviso'), ('comunicado', 'Comunicado');
```

Clique em **"Run"** para confirmar.

---

## Parte 3: Arquitetura de código (já implementada)

Esta seção documenta o que já está no repositório — não são passos a executar, é referência para quem for mexer no código depois.

### `server/db.ts` — persistência

Substitui por completo o antigo `readDb()`/`writeDb()` baseado em `data/database.json`. Estratégia:

- `readDb()` busca **todas** as tabelas do Supabase em paralelo, monta um objeto JS com a mesma forma que o antigo `DatabaseSchema` (mesmos nomes de campo em `camelCase`), roda a lógica de negócio contínua (geração de faturas mensais, sincronização de status de partida, auto-arquivamento do mural, vínculo usuário↔jogador) sobre esse objeto em memória — exatamente como antes — e persiste de volta com `writeDb()`.
- `writeDb(db)` compara um snapshot (capturado no `readDb()`) com o estado atual e só reescreve as tabelas que realmente mudaram (evita ficar regravando as 31 tabelas a cada requisição).
- Conversão `snake_case` (Postgres) ↔ `camelCase` (`src/types.ts`) é genérica, com duas exceções mapeadas explicitamente: `notification_preferences.all_enabled` ↔ `all` e `mural_posts.display_order` ↔ `order` (ambas por serem palavras reservadas do Postgres), e `users.athlete_id` que é propositalmente `snake_case` no próprio tipo TS.
- Sem foreign keys no schema (ver nota na Parte 2) — a integridade é mantida em código, do mesmo jeito que já era com o JSON.

### `server/auth.ts` — senha e sessão

- `hashPassword`/`verifyPassword`: bcrypt (`bcryptjs`), 10 rounds.
- `signSessionToken`/`verifySessionToken`: JWT assinado com `JWT_SECRET` (30 dias de validade).
- **Não usa o Supabase Auth hospedado** — ver nota na Parte 1.2.

### `server.ts` — rotas

- `getAuthenticatedUser` lê o header `Authorization: Bearer <token>`, valida o JWT e busca o usuário no banco. O antigo header `x-user-id` (forjável por qualquer cliente) foi removido.
- **Gate global de autenticação**: um middleware montado em `app.use('/api', ...)`, logo após o parsing do body e antes de todas as rotas, exige `getAuthenticatedUser(req)` bem-sucedido para qualquer requisição a `/api/*`, exceto uma allowlist explícita (`PUBLIC_API_ROUTES`: login, registro, forgot/reset-password, mural público, próximo jogo público). Cobre por padrão todas as rotas de negócio, presentes e futuras — não depende de cada rota lembrar de checar autenticação individualmente.
- `helmet()`, `cors()` (allowlist via `ALLOWED_ORIGINS`) e `express-rate-limit` nas rotas `/api/auth/*` (5 tentativas / 15 min).
- `/api/upload-s3` e `/api/mural/upload` sobem para o Supabase Storage (bucket `Uploads`), validando o tipo real do arquivo por magic bytes (`file-type` v22+) e o tamanho real do buffer decodificado — não a extensão/tamanho que o cliente declarar. Cada um também faz sua própria checagem de `getAuthenticatedUser` como defesa em profundidade, além do gate global.
- Geração de avatar com IA via `AvatarProviderFactory` (`server/avatarProvider.ts`): usa **OpenRouter** (`OPENROUTER_API_KEY`, modelo padrão `openai/gpt-image-1`) se configurado, com fallback para **Gemini direto** (`GEMINI_API_KEY`). Ver `.env.example` para as duas opções documentadas.
- **Nome do sistema configurável**: nenhum texto da interface tem o nome de um grupo específico hardcoded. `APP_NAME` (backend) é exposto ao frontend via `GET /api/public/app-config` e consumido pelo contexto `src/contexts/AppConfigContext.tsx` (`useAppConfig()`/`<BrandName />`) — troque o valor da variável e o nome muda em toda a interface, mensagens de WhatsApp e notificações, sem qualquer alteração de código.

### Frontend (`src/`)

- `src/lib/authFetch.ts` injeta `Authorization: Bearer <token>` (token salvo em `localStorage.racha_token` no login) em vez dos antigos headers `x-user-id`/`x-user-role`/`x-user-email`. Em resposta 401, limpa a sessão local e recarrega a página.
- **Toda** chamada ao backend no frontend passa por `authFetch` (não `fetch` puro) — era uma regra já documentada em `CLAUDE.md` mas violada em ~12 arquivos antes desta migração; foi corrigido.

---

## Parte 4: Testar Localmente

### Passo 4.1: Configurar `.env.local`

```
# Nome do seu sistema — aparece na interface, notificações e mensagens de WhatsApp/mural.
# Troque para o nome do seu próprio grupo; nunca deixe o nome de outra pessoa aqui.
APP_NAME="Meu Racha"

# Geração de avatar com IA — escolha uma opção (OpenRouter é a recomendada)
OPENROUTER_API_KEY="<sua-chave-openrouter>"
OPENROUTER_MODEL="openai/gpt-image-1"
# GEMINI_API_KEY="<sua-chave-gemini>"   # alternativa, usada só se OPENROUTER_API_KEY não estiver definida

APP_URL="http://localhost:3000"
SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<chave-service-role>"
ALLOWED_ORIGINS="http://localhost:3000"
JWT_SECRET="<gere com o comando abaixo>"
ENABLE_AVATAR_AI=false
NODE_ENV="development"
```

Gerar um `JWT_SECRET` forte:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Passo 4.2: Instalar dependências e rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

**Testes manuais recomendados**:
1. **Forjar autenticação**: chame `GET /api/users` (ou qualquer outra rota de negócio) sem header nenhum → deve retornar 401. Com o header antigo `x-user-id: user-admin` → também 401 (o header não existe mais; o gate global exige `Authorization: Bearer <token>` válido).
2. **Login**: `admin@racha.com` / `admin` → resposta deve incluir um `token` (JWT).
3. **Cadastro de jogador**: criar um jogador → confirmar que aparece na tabela `players` no Supabase (aba "Table Editor").
4. **Upload de mídia**: enviar uma imagem no mural ou no formulário de jogador → confirmar que aparece no bucket `Uploads` do Supabase Storage e que a URL abre sem autenticação.
5. **Rate limiting**: 6 tentativas de login com senha errada seguidas → a partir da 5ª, `429 Too Many Requests`.

### Passo 4.3: Build de produção local

```bash
npm run build
npm start
```

Acesse `http://localhost:3000` (frontend estático + API na mesma porta/processo).

---

## Parte 5: Deploy no Render

### Passo 5.1: Preparar repositório Git

```bash
git add .
git commit -m "chore: migrate to Supabase + Render with security hardening"
git push origin main
```

(O `Dockerfile` já existe na raiz do projeto — não precisa criar.)

### Passo 5.2: Criar serviço no Render

1. Acesse [https://render.com](https://render.com) e faça login.
2. **"New"** → **"Web Service"**.
3. Conecte o repositório GitHub.
4. Preencha:
   - **Name**: `racha-do-fofim`
   - **Runtime**: Docker (Render detecta o `Dockerfile` automaticamente)
   - **Plan**: Free (ou Starter, se o cold start do free incomodar)
5. **Não clique em criar ainda** — configure as variáveis de ambiente primeiro (próximo passo).

### Passo 5.3: Configurar variáveis de ambiente no Render

Na seção **"Environment"** do formulário de criação (ou depois, em Settings → Environment):

| Variável | Valor |
|---|---|
| `APP_NAME` | o nome do seu grupo/sistema (ex: `"Racha da Vila"`) — aparece na UI e em mensagens |
| `OPENROUTER_API_KEY` | sua chave OpenRouter (recomendado — ver `.env.example`) |
| `OPENROUTER_MODEL` | `openai/gpt-image-1` (opcional, é o padrão) |
| `GEMINI_API_KEY` | alternativa ao OpenRouter, se preferir usar o Gemini direto |
| `SUPABASE_URL` | URL do seu projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service role do Supabase |
| `JWT_SECRET` | uma string aleatória forte (gere com o comando do Passo 4.1 — **use um valor diferente do de dev**) |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://<seu-dominio>.onrender.com` (você só sabe o domínio definitivo depois do primeiro deploy; pode editar essa variável e re-deployar depois) |

Clique em **"Create Web Service"**. O Render builda a imagem Docker e sobe o serviço (alguns minutos no primeiro deploy).

### Passo 5.4: Confirmar deployment

1. Acesse a URL pública gerada pelo Render.
2. Repita os testes manuais do Passo 4.2 contra essa URL.
3. Se `ALLOWED_ORIGINS` foi configurado antes de saber o domínio final, atualize a variável com o domínio real e deixe o Render re-deployar.

---

## Parte 6: Checklist Pós-Deploy

- [ ] Login funciona e retorna um `token` JWT.
- [ ] `GET /api/users` sem token retorna 401 (não a lista de usuários).
- [ ] Criar jogador → aparece na tabela `players` no Supabase.
- [ ] Upload de imagem → aparece no bucket `Uploads` e a URL é pública.
- [ ] 6 tentativas de login falhadas seguidas → `429` a partir da 5ª.
- [ ] Sem erros 500 nos logs do Render.
- [ ] Sorteio de times, fila de reservas, financeiro e mural funcionam ponta a ponta.

---

## Troubleshooting

### "Bucket not found" no upload
O nome do bucket no Supabase Storage é case-sensitive. Confirme que o bucket se chama exatamente `Uploads` (U maiúsculo) — é o que `server.ts` usa em `supabase.storage.from('Uploads')`.

### "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios"
Variável de ambiente não configurada (Render ou `.env.local`). Confirme os valores no Passo 5.3 (produção) ou 4.1 (local).

### "JWT_SECRET é obrigatório"
Mesma causa acima, mas para a variável `JWT_SECRET` (ver `server/auth.ts`).

### `relation "users" does not exist`
O schema SQL (Parte 2.2) não foi executado nesse projeto Supabase. Rode novamente no SQL Editor.

### Upload funciona localmente mas não no Render
Confirme que o bucket está marcado como **Public** (Storage → bucket `Uploads` → Edit bucket).

### Build falha no Render
Veja a aba "Logs" → "Build Logs". Causas comuns: `package-lock.json` desatualizado (rode `npm install` local e commite), erro de TypeScript (rode `npm run lint` local antes de fazer push), variável de ambiente faltando.

---

## Perguntas Frequentes

**Quanto custa por mês?**
R$ 0 (planos free do Render + Supabase) enquanto o grupo for pequeno. Se crescer: Render Starter (~R$ 7/mês), Supabase Pro (~R$ 25/mês) se ultrapassar as quotas do free tier.

**Como faço backup dos dados?**
Supabase oferece backups automáticos (Database → Backups no dashboard).

**Próximos passos fora deste deploy** (não bloqueiam ir ao ar):
1. Padronização de UI/mobile (kit de componentes, alvo de toque ≥44px, tabelas responsivas) — já auditado, tratado como iteração separada.
2. Testes automatizados (o projeto não tem suíte hoje).
3. CI/CD (GitHub Actions rodando `npm run lint` a cada push).
4. Monitoramento de erros em produção (Sentry ou similar).

---

**Fim do .DEPLOY.md**
