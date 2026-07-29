---
type: Architecture
title: Visão Geral da Arquitetura
description: Visão geral da arquitetura do Fut.Manager, cobrindo o backend Node/Express, persistência Postgres e frontend React.
tags: [architecture, backend, frontend, database]
---

# Visão Geral da Arquitetura

O Fut.Manager é uma aplicação full-stack executada em um único processo **Node/Express**, utilizando uma arquitetura baseada em API REST para comunicação entre o frontend React e a persistência Postgres.

## Core Backend (`server.ts`)
Toda a lógica de API (`/api/*`) reside em `server.ts`. O backend não utiliza roteamento modularizado; as rotas são definidas centralmente, facilitando a busca por endpoints ao procurar pelos métodos `app.get`, `app.post`, etc.

- **Middlewares**: Segurança fornecida pelo `helmet()`, `cors()` (via `ALLOWED_ORIGINS`) e `express-rate-limit` para rotas de autenticação.
- **Ambiente**: Em desenvolvimento, utiliza Vite em *middleware mode*. Em produção, serve os estáticos de `dist/` com fallback para SPA.

## Persistência (`server/db.ts`)
A persistência utiliza o **Supabase (@supabase/supabase-js)** para interagir com o Postgres.
- Não há arquivo JSON local; toda a operação ocorre no banco.
- O mapeamento entre `snake_case` (DB) e `camelCase` (Code) é genérico, facilitando a manutenção e a sincronização de dados.
- Não utiliza chaves estrangeiras (FKs); a integridade referencial é gerenciada em nível de código (aplicação).

## Autenticação (`server/auth.ts`)
O sistema utiliza um esquema de autenticação própria (bcrypt + JWT), e **não** o Supabase Auth.
- Isso preserva o uso de IDs do tipo `TEXT` em todo o sistema.
- JWTs são assinados com `JWT_SECRET`.
- A verificação de usuários autenticados ocorre em `getAuthenticatedUser`, via header `Authorization: Bearer <token>`.

## Frontend (`src/`)
A aplicação React utiliza:
- **`src/types.ts`**: Fonte única da verdade para tipos, compartilhada entre cliente e servidor.
- **`src/lib/authFetch.ts`**: Wrapper essencial para todas as chamadas `fetch` ao backend. **Toda chamada autenticada deve passar por aqui**, garantindo a injeção correta do JWT.
- **Contextos**: O nome do sistema (brand) é gerenciado dinamicamente via `AppConfigContext`, evitando hardcoding de nomes de grupos.

## Visão Geral técnica
- **Motor de Sorteio**: Algoritmo Monte Carlo (`server/drawEngine.ts`) para times equilibrados (`runSmartDraw`).
- **Estatísticas**: Cálculos dinâmicos em `server/statsEngine.ts`, recalculados por temporada.
- **Avatares/Cards**: `server/avatarProvider.ts` gerencia integração com IA (OpenRouter ou Gemini).
- **Uploads**: Armazenamento via Supabase Storage (bucket `Uploads`, público).

Para documentação detalhada de deploy e operações, ver `operations/deploy-guide.md` e `operations/deploy-checklist.md`.
