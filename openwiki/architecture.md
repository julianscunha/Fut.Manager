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

## Notificações e E-mails (`server/email.ts`)
O Fut.Manager utiliza **TurboSMTP** para envio de e-mails transacionais, incluindo:
- **E-mails de cadastro**: `registration-pending`, `registration-approved`, `registration-rejected`
- **E-mails de boas-vindas**: `welcome`
- **E-mails de redefinição de senha**: `password-reset`
- **E-mails de reativação**: `reengage-inactive`
- **E-mails de notificação geral**: `notification`

### Integração com Fluxo de Trabalho de Usuários
As rotas em `/api/auth/register` e `/api/users/action` acionam automaticamente:
- Criação de notificação no banco de dados (`notify`)
- Disparo de e-mails de acordo com o status (`isEmailConfigured` verifica `TURBO_API_KEY` e `TURBO_API_SECRET`)
- Envio assíncrono através de `sendEmail` com retry para falhas temporárias

### Template de E-mail
Todos os templates utilizam um sistema baseado em HTML/CSS consistente (`server/email-templates/base.ts`), garantindo brand consistency e capacidade de manutenção.

## Frontend (`src/`)
A aplicação React utiliza:
- **`src/types/domain.ts`** (entidades de negócio) e **`src/types/ui.ts`** (labels, cores, pesos de atributos): fonte da verdade para tipos, compartilhada entre cliente e servidor. `src/types.ts` (raiz) e `src/types/index.ts` são barrels de compatibilidade que reexportam os dois — não adicionar tipos novos ali.
- **`src/lib/authFetch.ts`**: wrapper padrão para todas as chamadas `fetch` ao backend. **A maioria das chamadas autenticadas passa por aqui**, garantindo a injeção correta do JWT.
- **`src/api/client.ts`** (`apiClient`) e **`src/contexts/AuthContext.tsx`** (`useAuth`): infraestrutura mais nova (cliente HTTP tipado + estado de auth via contexto), criada como alternativa ao `authFetch` + leitura direta de `localStorage`, mas ainda **opt-in** — poucos componentes migrados até agora. Ao usar, importar via aliases `@api/*`/`@contexts/*` (ver `tsconfig.json`).
- **`src/components/ErrorBoundary.tsx`**: recuperação de erro em nível de componente, alternativa ao hard-reload que `authFetch` dispara em respostas 401.
- **Contextos**: o nome do sistema (brand) é gerenciado dinamicamente via `AppConfigContext`, evitando hardcoding de nomes de grupos.

### Migrando um componente de `authFetch` para `apiClient` (opcional)
1. Trocar `authFetch(...)` por `apiClient.get/post/put/patch/delete<T>(...)` — já retorna o corpo tipado, sem `.json()` manual.
2. Tratar erros como `ApiError` em vez de depender do reload automático em 401.
3. Rodar `npm run lint` para conferir os imports.
4. Testar login/logout e o fluxo do componente manualmente.

`AuthProvider` já está montado na raiz do app (`src/main.tsx`) — não precisa adicionar de novo.

## Visão Geral técnica
- **Motor de Sorteio**: Algoritmo Monte Carlo (`server/drawEngine.ts`) para times equilibrados (`runSmartDraw`).
- **Estatísticas**: Cálculos dinâmicos em `server/statsEngine.ts`, recalculados por temporada.
- **Avatares/Cards**: `server/avatarProvider.ts` gerencia integração com IA (OpenRouter ou Gemini).
- **Uploads**: Armazenamento via Supabase Storage (bucket `Uploads`, público).

Para documentação detalhada de deploy e operações, ver `operations/deploy-guide.md` e `operations/deploy-checklist.md`.