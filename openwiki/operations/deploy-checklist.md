---
type: Deployment Checklist
title: Checklist de Deploy — Fut.Manager (Supabase + Render)
description: Checklist completo que auxilia equipes DevOps na avaliação de práticas de migração de infra e confirmações de infraestrutura antes da exposição pública no Render.
tags: [deploy, checklist, supabase, render]
---

# Checklist de Deploy

Este checklist reflete os itens comprovados no plano de migração e garante que nenhuma etapa crítica seja esquecida.

## 1. Pré-Deploy - Supabase
- [ ] Crie projeto Supabase (nome, password, região, plano gratuito).
- [ ] Anote `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Crie bucket `Uploads` com visibilidade pública.
- [ ] Reteve `/scripts/post-install.sql` no projeto e execute no SQL Editor.
- [ ] Certifique que a configuração do schema corresponde a `src/types.ts`.
- [ ] Inicie migrações de usuário/padrão (admin, jogadores, temporadas).

## 2. Pré-Deploy - Render / Docker
- [ ] Remova quaisquer arquivos de build descartáveis.
- [ ] Adicione `Dockerfile` na raiz do repositório.
- [ ] Verifique comandos: `npm install`, `npm run build`, `npm start`.
- [ ] Configure variáveis de ambiente no Render: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `NODE_ENV=production`, etc.
- [ ] Manualmente, teste o endpoint `GET /api/users` sem token - deve retornar 401.
- [ ] Teste `POST /api/auth/login` com credenciais do admin - deve retornar JWT.

## 3. Deploy no Render
- [ ] Commit das alterações (Dockerfile, .env.local, scripts, readme).
- [ ] Vá ao Dashboard Render -> New -> Web Service.
- [ ] Conecte repository, setar branch `main`.
- [ ] Build Command: `npm install && npm run build`.
- [ ] Start Command: `npm start`.
- [ ] Salve e faça deploy.
- [ ] Após deploy, navegue até a URL do serviço.
- [ ] Verifique que a rota de login funciona e todos os recursos do back-end respondem.

## 4. Pós-Deploy
- [ ] Verifique rotas públicas: `/api/auth/login`, `/api/visuais/*`.
- [ ] Confirme que rotas protegidas exigem token JWT.
- [ ] Valide que uploads de imagens funcionam com o bucket `Uploads`.
- [ ] Execute testes de interceptação de tempo de resposta usando curl.
- [ ] Avalie logs do Render para verificação de erros.

---

*Este checklist foi extraído e sintetizado do documento de auditoria (Auditoria - Hardening de Segurança) e confirma o alinhamento com o plano de migração de infraestrutura.*