# Checklist de Deploy — "Racha do Fofim" (Supabase + Render)

Checklist detalhado complementar ao [`DEPLOY.md`](DEPLOY.md). Use para não esquecer nenhuma etapa antes, durante e depois do deploy.

---

## ✅ PRÉ-DEPLOY (Ambiente local)

### Preparação do Supabase
- [ ] Projeto Supabase criado
- [ ] Project URL guardado (`SUPABASE_URL`)
- [ ] Service Role Key guardado (`SUPABASE_SERVICE_ROLE_KEY`, aba Settings → API)
- [ ] Storage bucket `Uploads` (com U maiúsculo) criado e marcado como público
- [ ] Schema SQL (Parte 2 do `DEPLOY.md`) executado com sucesso no SQL Editor
- [ ] Admin padrão (`user-admin` / `admin@racha.com` / senha `admin`, já com hash bcrypt) inserido
- [ ] Temporada padrão (`season-2026`), config recorrente e config financeira inseridas

### Preparação do código
- [ ] `npm install` rodado
- [ ] `.env.local` criado com: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `OPENROUTER_API_KEY` (ou `GEMINI_API_KEY` como alternativa), `ALLOWED_ORIGINS="http://localhost:3000"`
- [ ] `.gitignore` cobre `.env*`, `data/database.json`, `data/database.json.backup`, `data/uploads/`

### Testes locais
- [ ] `npm run lint` passa sem erros (type-check)
- [ ] `npm run dev` inicia sem exceções
- [ ] Frontend carrega em `http://localhost:3000`
- [ ] `GET /api/users` sem header de autenticação → 401
- [ ] `GET /api/users` com header antigo `x-user-id: user-admin` (forjado) → também 401 (header não existe mais)
- [ ] Login com `admin@racha.com` / `admin` → resposta inclui `token` (JWT)
- [ ] `GET /api/users` com `Authorization: Bearer <token>` do login → 200, lista de usuários
- [ ] Cadastro de jogador → confirma no Supabase (Table Editor → `players`)
- [ ] Upload de imagem (mural ou avatar) → aparece no bucket `Uploads` do Supabase Storage, URL pública abre sem autenticação
- [ ] Upload de arquivo não-imagem disfarçado (ex: `.txt` renomeado para `.png`) → rejeitado (validação por magic bytes via `file-type`)
- [ ] Qualquer rota de negócio (`/api/matches`, `/api/players`, etc.) sem `Authorization: Bearer` → `401` (gate global de autenticação em `server.ts`)
- [ ] Rotas públicas (`/api/auth/login`, `/api/mural/public-posts`, `/api/public/next-match`) seguem acessíveis sem token
- [ ] 6 tentativas de login com senha errada seguidas → `429` a partir da 5ª
- [ ] `npm run build` gera `dist/` sem erros
- [ ] `npm start` (produção local) roda e serve frontend + API na mesma porta

### Git e repositório
- [ ] `Dockerfile` presente na raiz e commitado
- [ ] `data/database.json` removido do repositório (dados migraram para Postgres)
- [ ] Mudanças commitadas:
  ```bash
  git add .
  git commit -m "chore: migrate to Supabase + Render with security hardening"
  git push origin main
  ```

---

## ✅ DEPLOY (Configuração Render)

### Criar Web Service no Render
- [ ] Conta Render criada, repositório GitHub conectado
- [ ] Novo Web Service criado a partir do `Dockerfile` (Render detecta automaticamente)
- [ ] Branch: `main`
- [ ] Plan: Free (ou Starter, se cold start incomodar)

### Variáveis de Ambiente (Render Dashboard → Environment)
- [ ] `OPENROUTER_API_KEY` (recomendado) e/ou `GEMINI_API_KEY` (ao menos um definido — ver `AvatarProviderFactory` em `server/avatarProvider.ts`)
- [ ] `OPENROUTER_MODEL` (opcional, padrão `openai/gpt-image-1`)
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `JWT_SECRET` (valor diferente do usado em dev/local)
- [ ] `NODE_ENV=production`
- [ ] `ALLOWED_ORIGINS` (domínio `.onrender.com` — pode ajustar depois do primeiro deploy)

### Deploy
- [ ] Build finaliza com sucesso (aba "Logs" → "Build Logs")
- [ ] Serviço com status "Live"
- [ ] URL pública atribuída

---

## ✅ PÓS-DEPLOY (Verificação em produção)

### Acesso e navegação
- [ ] Página carrega sem erro 500
- [ ] Sem erros de CORS no console do navegador

### Autenticação e segurança
- [ ] Login funciona, token JWT retornado
- [ ] `/api/users` sem token → 401
- [ ] 6 tentativas de login falhadas seguidas → `429`

### Persistência de dados
- [ ] Criar/editar jogador → persiste após refresh (Supabase Table Editor confirma)
- [ ] Soft delete de jogador → some da lista, histórico preservado
- [ ] Fatura criada/paga → persiste

### Upload e Storage
- [ ] Upload de imagem aparece e é exibido
- [ ] URL de upload é pública (abre em aba anônima)
- [ ] Upload de arquivo inválido é rejeitado

### Fluxos críticos
- [ ] Sorteio de times: confirmar → sortear → ajustar → travar
- [ ] Fila de reservas: mensalista cancela → reserva convocado
- [ ] Financeiro: mensalidades geradas/pagas
- [ ] Mural: criar, listar, destacar, remover post

### Logs
- [ ] Sem erro 500 nos logs do Render
- [ ] Sem erro de conexão com Supabase nos logs

---

## ⚠️ Rollback

1. `git revert HEAD && git push` (Render re-deploya automaticamente)
2. Ou: Render Dashboard → Web Service → Settings → "Suspend" (pausa enquanto corrige)
3. Recuperação de dados: Supabase → Database → Backups

---

## 🎯 Conclusão

Com tudo ✅, a aplicação está em produção:
- **Frontend + Backend**: `https://<seu-dominio>.onrender.com`
- **Dados**: Postgres via Supabase
- **Uploads**: Supabase Storage (bucket `Uploads`, público)
- **Auth**: bcrypt + JWT próprio (sem headers forjáveis, sem Supabase Auth hospedado)

Próximos passos: monitorar logs por 24-48h, avisar o grupo, e considerar a iteração de padronização de UI/mobile (fora deste deploy).
