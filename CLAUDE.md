# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

"Racha do Fofim" — cockpit de gestão de um grupo privado de futebol society (mensalistas, reservas, sorteio de times, financeiro, mural social, ranking). Projeto originado no Google AI Studio, com integração à Gemini API para geração de avatares/cards de jogadores.

## Comandos

```bash
npm install       # instalar dependências
npm run dev        # inicia o servidor (tsx server.ts), com Vite em middleware mode (HMR)
npm run build       # build client (vite build) + bundle do servidor (esbuild -> dist/server.cjs)
npm start         # roda o build de produção (node dist/server.cjs)
npm run lint       # type-check apenas (tsc --noEmit) — não há linter de estilo configurado
npm run clean       # remove dist/
```

Não há suíte de testes configurada neste repositório.

Variáveis de ambiente (ver `.env.example`): `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` (recomendado para geração de avatar) ou `GEMINI_API_KEY` (alternativa — ao menos um dos dois é necessário para `ENABLE_AVATAR_AI=true`), `APP_URL`, `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (obrigatórias — Postgres e Storage), `JWT_SECRET` (obrigatória — assina os tokens de sessão), `ALLOWED_ORIGINS` (CORS), `ENABLE_AVATAR_AI`. Ver `docs/DEPLOY.md` para o guia completo de setup do Supabase e deploy no Render.

## Arquitetura

Aplicação full-stack em um único processo Node/Express, servida em `http://localhost:3000`.

- **`server.ts`** (raiz, arquivo único e grande ~6200 linhas) — define TODAS as rotas REST sob `/api/*` dentro de `startServer()`. Não há roteador modularizado; para achar um endpoint, busque por `app.get(`/`app.post(`/`app.put(`/`app.delete(` neste arquivo. Em desenvolvimento (`NODE_ENV !== 'production'`), o Vite roda em *middleware mode* dentro do mesmo processo Express; em produção, serve os estáticos de `dist/` com fallback SPA. Middlewares de segurança globais: `helmet()`, `cors()` (allowlist via `ALLOWED_ORIGINS`) e `express-rate-limit` nas rotas `/api/auth/*`.
- **`server/db.ts`** — camada de persistência: Postgres via Supabase (`@supabase/supabase-js`), sem arquivo JSON local. `readDb()`/`writeDb()` fazem leitura/escrita em lote de todas as tabelas, convertendo `snake_case` (Postgres) ↔ `camelCase` (`src/types.ts`) genericamente; um `WeakMap` de snapshot evita reescrever tabelas que não mudaram desde o último `readDb()`. Schema criado manualmente via SQL (ver `docs/DEPLOY.md`), sem FKs (`REFERENCES`) — a integridade referencial é gerenciada em código, igual ao modelo anterior em JSON. Contém também `generateMonthlyBillingsIfNeeded` (motor de cobrança mensal) e a lógica contínua de sincronização de status de partida/mural/reservas, preservada da versão anterior.
- **`server/auth.ts`** — hash de senha (bcrypt) e emissão/verificação de token de sessão (JWT assinado com `JWT_SECRET`). Autenticação NÃO usa o Supabase Auth hospedado (que exigiria UUIDs e romperia o esquema de IDs `TEXT` do app) — é um JWT próprio, verificado em `getAuthenticatedUser` (`server.ts`) via header `Authorization: Bearer <token>`.
- **`server/drawEngine.ts`** — algoritmo Monte Carlo (`runSmartDraw`, até 5000 iterações) para sortear os times equilibrando Overall, presença mínima de posições defensivas/ofensivas por time e afinidades históricas de duplas/trios (`recordAffinities`).
- **`server/statsEngine.ts`** — cálculo de estatísticas por temporada (`computeStatsForSeason`), incluindo streaks — sempre recalculados dinamicamente a partir das partidas filtradas da temporada (nunca usar `player.currentStreak` global diretamente para views filtradas por temporada; ver histórico do bug em `docs/AUDITORIA.md` §"Bug de Estatísticas de Streaks").
- **`server/avatarProvider.ts`** — fábrica de provedores de geração de avatar/card (`AvatarProviderFactory`), priorizando OpenRouter (`OpenRouterAvatarProvider`, modelo padrão `openai/gpt-image-1`) sobre Gemini direto (`GeminiAvatarProvider`) conforme a variável de ambiente definida.
- **`src/App.tsx`** — componente raiz React, controla autenticação (`currentUser` salvo em `localStorage.racha_user`, token de sessão em `localStorage.racha_token`), navegação por abas (`NavTab`) persistida em `localStorage.racha_active_tab`, e roteamento simples por hash (`#/players/:id`) para deep-link de perfil de jogador.
- **`src/components/`** — um componente "Manager" por domínio (CalendarManager, DrawManager, FinanceManager, EventManager, MuralManager, NotificationCenter, LaboratorioManager, UserApprovalList, TechnicalRanking, etc.), cada um consumindo diretamente os endpoints REST correspondentes via `authFetch`.
- **`src/lib/authFetch.ts`** — wrapper de `fetch` que injeta automaticamente o header `Authorization: Bearer <token>` a partir do token salvo em `localStorage.racha_token`. **Toda chamada ao backend deve passar por `authFetch`**, nunca `fetch` puro — rotas autenticadas verificam esse JWT no servidor (`getAuthenticatedUser`), não há mais header `x-user-id` (removido por ser forjável). Em resposta 401, `authFetch` limpa a sessão local e recarrega a página.
- **`src/types.ts`** — fonte única de tipos compartilhados entre client e server (importados diretamente em `server.ts`/`server/*.ts` via `../src/types`), incluindo os pesos de atributos técnicos (`LINE_ATTRIBUTES`, pesos de goleiro) usados no cálculo de Overall.
- **Uploads** (fotos de jogador, mídia do mural) — Supabase Storage (bucket público `Uploads`, com U maiúsculo — nome case-sensitive), com validação de tipo por magic bytes (`file-type`) e tamanho real do buffer decodificado. Não há mais disco local (`data/uploads/`) nem simulação de S3.

### Modelo de domínio essencial

- **Papéis de usuário** (`UserRole`): `admin`, `auxiliar`, `jogador`. Vínculo `User` ↔ `Player` é por igualdade de e-mail normalizado (`email.toLowerCase().trim()`) ou por `playerId` explícito (`getPlayerIdForUser` em `server.ts`).
- **Categorias de jogador** (`PlayerCategory`): apenas `mensalista` e `reserva` (não existe categoria `mensalista_goleiro` separada, apesar de versões antigas deste documento mencionarem — goleiros mensalistas são identificados por `primaryPosition === 'goleiro'` e ficam isentos da cobrança mensal via essa checagem em `generateMonthlyBillingsIfNeeded`, não por uma categoria própria). `reserva` é isento de mensalidade e da cobrança de eventos sociais/churrasco.
- **Ciclo de vida de partida**: `agendada` → `confirmando` → `encerrada`/`cancelada`, com deadline de confirmação calculado a partir de `recurrentConfig` (dias antes do jogo).
- **Fila de reservas**: quando um mensalista cancela presença, o sistema convoca reservas pela ordem de `reservesOrder`, com alertas e endpoints dedicados (`/api/matches/:matchId/reserve-queue/*`).
- **Sorteio de times**: fluxo `/api/matches/:matchId/draw` → `/api/draws/:drawId/update-manual` (ajuste manual) → `/api/draws/:drawId/confirm-lock` (trava o sorteio). Atenção: `confirm-lock` e `/results` podem ambos incrementar afinidades de duplas/trios se acionados em sequência na mesma semana — ver `docs/AUDITORIA.md` para o problema conhecido de duplicidade.
- **Autenticação de rotas `/api/*`**: gate global em `server.ts` (`app.use('/api', ...)`) exige `Authorization: Bearer <token>` válido para qualquer rota não listada em `PUBLIC_API_ROUTES` (login, registro, forgot/reset-password, mural público, próximo jogo público). Os regexes desse allowlist não incluem o prefixo `/api` — o Express já o remove de `req.path` dentro de um middleware montado com `app.use('/api', ...)`.

Para entendimento aprofundado de regras de negócio, edge cases já mapeados e problemas conhecidos, consulte `docs/AUDITORIA.md` (auditoria funcional completa) e `docs/` (arquitetura da home dinâmica, handoff e guias de deploy).
