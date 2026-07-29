---
type: Deployment Guide
title: Guia de Deploy do Fut.Manager para Render + Supabase
description: Step-by-step instructions to set up Supabase (schema, storage, admin user), configure .env.local, and deploy the container to Render, including verification steps and git checklist.
resource: /docs/DEPLOY.md
tags: [deploy, supabase, render, DevOps, infrastructure]
---

# Guia de Deploy do Fut.Manager para Render + Supabase

Este documento descreve a arquitetura de produção já implementada no repositório (Postgres + Storage via Supabase, autenticação própria com bcrypt + JWT, hospedagem no Render) e o roteiro para colocar o app no ar.

**Status**: a migração de código já está feita e testada de ponta a ponta contra um projeto Supabase real (login, CRUD de jogadores, upload de imagem, build de produção). O que falta é você provisionar seu próprio projeto Supabase (se ainda não tiver) e fazer o deploy no Render.

---

## Parte 1: Preparação e Setup Supabase

### Passo 1.1: Criar projeto Supabase

1. Acesse [https://supabase.com](https://supabase.com) e faça login (ou crie uma conta gratuita).
2. Clique em **"New project"**.
3. Preencha:
   - **Project name**: `fut-manager` (ou nome à sua escolha)
   - **Database password**: gere uma senha forte (usada só internamente pelo Supabase; você não vai precisar dela diretamente, já que o app fala com o Supabase via API/service role, não via conexão Postgres direta)
   - **Region**: a mesma região do seu serviço Render (ver Passo 5.2) — não necessariamente a mais próxima fisicamente de você. Toda leitura/escrita do app passa pelo backend no Render, então o que importa é a latência Render↔Supabase, não a latência usuário↔Supabase. Ex.: se o Render vai rodar em `Virginia (US East)` (a região do Render mais próxima do Brasil, já que o Render não tem região na América do Sul), escolha `East US (North Virginia)` aqui também.
   - **Pricing plan**: Free
4. Clique em **"Create new project"** e aguarde ~2 minutos.

### Passo 1.2: Configurar variáveis de ambiente no dashboard Supabase

1. Em **Settings → API**, guarde:
   - **Project URL** (ex: `https://xxxxxxxxxxxxx.supabase.co`) → vai virar `SUPABASE_URL`
   - **Project Ref** → para referência futura
2. Não há necessidade de habilitar o Supabase Auth — o sistema usa autenticação própria (bcrypt + JWT).

### Passo 1.3: Criar Storage bucket para uploads

1. No dashboard, clique em **"Storage"** (aba esquerda).
2. Clique em **"Create a new bucket"**.
3. Preencha:
   - **Bucket name**: `Uploads` (exatamente assim, com U maiúsculo — o nome é case-sensitive e precisa bater com `supabase.storage.from('Uploads')` em `server.ts`)
   - **Public bucket**: ✅ **Sim** (as URLs de foto/mídia geradas precisam ser públicas)
4. Clique em **"Create bucket"**.

> Este projeto **não usa o Supabase Auth hospedado** (o sistema de login com usuários/UUID próprios do Supabase). A autenticação é feita por conta própria (bcrypt + JWT — ver [Hardening de Segurança](../architecture/security.md)), para preservar o esquema de IDs `TEXT` (`user-admin`, `player-admin`, etc.) que o app já usa em todo lugar. Não há nenhum passo de "Habilitar Auth" a fazer no dashboard do Supabase.

---

## Parte 2: Criar o Schema Postgres

### Passo 2.1: Abrir SQL Editor do Supabase

No dashboard, clique em **"SQL Editor"** → **"New query"**.

### Passo 2.2: Criar as tabelas

Este schema espelha campo a campo as interfaces em `src/types.ts`. Cole e rode no SQL Editor:

> **Nota:** O schema completo (31 tabelas) é espelhado em `src/types.ts` — consulte esse arquivo para a lista atualizada de campos e restrições. O schema abaixo cobre as tabelas essenciais (users, passwords, players, seasons, matches, presences, draws).

### Passo 2.3: Inserir dados padrão

Após executar o schema SQL, insira os registros iniciais:

- **Admin padrão:**
  - `id`: `user-admin`
  - `name`: `Admin do Sistema`
  - `email`: `admin@racha.com`
  - `role`: `admin`
  - `status`: `approved`
  - `password_hash`: hash gerado por `pgcrypto`; a senha padrão é `admin` (veja abaixo).

- **Temporada padrão:**
  - `name`: `season-2026`
  - `year`: `2026`

- **Configuração recorrente** e **configuração financeira** — inseridos via SQL conforme o esquema em `DEPLOY.md`.

---

## Parte 3: Configuração do Código

### Passo 3.1: Criar `.env.local`

```env
APP_NAME=Seu Nome de Grupo
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
JWT_SECRET=uma-cadeia-curta-e-secreta
OPENROUTER_API_KEY=sua-chave-openrouter (ou GEMINI_API_KEY como alternativa)
ALLOWED_ORIGINS=http://localhost:3000
```

### Passo 3.2: `npm install`

Execute no diretório do projeto para instalar todas as dependências (incluindo `bcryptjs`, `jsonwebtoken`, `express-rate-limit`, `helmet`, `file-type`, `pgcrypto`).

### Passo 3.3: Testes locais

Verifique a porta padrão (3000) e acessibilidade do frontend em `http://localhost:3000`.

| Requisição | Esperado |
| :--- | :--- |
| `GET /api/users` sem header | `401` |
| `GET /api/users` com `x-user-id` forjado | `401` (header não existe mais — ver [Hardening §1](../architecture/security.md)) |
| `POST /api/auth/login` com `admin@racha.com` / `admin` | Resposta inclui `token` (JWT) |
| `GET /api/users` com `Authorization: Bearer <token>` | `200`, lista de usuários |

---

## Parte 4: Deploy no Render

### Passo 4.1: Preparar Dockerfile

O projeto deve ter um `Dockerfile` na raiz que contemple:

- Build do frontend + API.
- Exposição da porta configurada (padrão: 3000).
- Comando de inicialização (`npm start`).

### Passo 4.2: Criar serviço no Render

1. Acesse [Render Dashboard](https://dashboard.render.com).
2. Clique em **"New"** → **"Web Service"**.
3. Conecte seu repositório GitHub.
4. Configure:
   - **Name**: `fut-manager` (ou seu nome).
   - **Region**: `Oregon (US West)` ou a região mais próxima da sua localização.
   - **Branch**: `main`.
   - **Build Command**: `npm run build` (ou `npm install && npm run build`).
   - **Start Command**: `npm start` (ou o comando que inicia o servidor Node.js após o build).
   - **Instance Type**: Free ou Basic (conforme previsão de tráfego).
   - **Environment Variables** (adicione no painel do Render, não no repo):
     - `SUPABASE_URL` = (mesmo valor do `.env.local`)
     - `SUPABASE_SERVICE_ROLE_KEY` = (mesmo valor do `.env.local`)
     - `JWT_SECRET` = (mesmo valor do `.env.local`)
     - `ALLOWED_ORIGINS` = `https://seu-dominio-no-render.onrender.com` (adicione `http://localhost:3000` para desenvolvimento)
     - `OPENROUTER_API_KEY` = (sua chave)

### Passo 4.3: Deploy e verificação

Após o deploy, acesse a URL gerada pelo Render e verifique:

- Frontend carrega sem erros.
- Login com `admin@racha.com` / `admin` retorna token JWT.
- Rotas públicas (`/api/auth/login`, `/api/mural/public-posts`, `/api/public/next-match`) funcionam sem token.
- Rotas protegidas exigem `Authorization: Bearer <token>`.

### Passo 4.4: Commit e push do `Dockerfile`

O `Dockerfile` deve estar presente na raiz e commitado no repositório, junto com todas as mudanças de migração, antes do deploy:

```bash
git add .
git commit -m "chore: migrate to Supabase + Render with security hardening"
git push origin main
```

---

## Relacionamentos

Este documento depende do [Relatório de Auditoria](../architecture/audit-report.md) (que descreve os problemas de persistência e autenticação que motivaram esta arquitetura) e do [Hardening de Segurança](../architecture/security.md) (que explica as correções de autenticação e CORS presentes no deploy). Para um checklist detalhado pré-deploy, consulte o [Checklist de Deploy](./deploy-checklist.md).