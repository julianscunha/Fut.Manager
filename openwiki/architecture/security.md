---
type: "Referência"
title: "Hardening de Segurança Operacional"
openwiki_generated: true
---

# Hardening de Segurança Operacional

Auditoria de segurança encontrou e corrigiu, antes de expor o sistema publicamente, oito vulnerabilidades críticas e de alto risco. Cada correção é descrita abaixo com o contexto do problema, a solução implementada e a validação realizada.

---

## 1. Impersonation Total (Crítico)

`getAuthenticatedUser` confiava cegamente no header `x-user-id` enviado pelo cliente — qualquer requisição podia forjar esse header e agir como qualquer usuário, inclusive admin.

**Correção:** Autenticação por JWT assinado (`server/auth.ts`), verificado via header `Authorization: Bearer <token>`.

**Validação:** Testado explicitamente — forjar o header antigo (`x-user-id`) agora retorna `401`.

**Arquivo impactado:** `server/auth.ts`

---

## 2. Senha em Texto Puro (Crítico)

Senhas armazenadas sem hash — qualquer acesso ao banco expunha credenciais em texto claro.

**Correção:** Hash bcrypt (10 rounds) via `bcryptjs`, com seed inicial gerado por `pgcrypto` no próprio SQL.

**Arquivo impactado:** `server/auth.ts`, schema SQL (`passwords` table)

---

## 3. Reset de Senha sem Validar Token (Crítico)

`/api/auth/reset-password` trocava a senha de qualquer usuário sem checar o token gerado em `/forgot-password`.

**Correção:** Token com expiração de 15 minutos, validado e descartado após uso único.

**Arquivo impactado:** `server/auth.ts` (reset-password handler)

---

## 4. Vazamento de Dados de Usuários (Crítico)

`GET /api/users` retornava a lista completa (incluindo e-mails) sem autenticação nenhuma.

**Correção:** Exige role `admin` ou `auxiliar`.

**Arquivo impactado:** `server/routes/users`

---

## 5. Confiança em `role` Vindo do Cliente (Alto)

~7 rotas (mural, eventos, financeiro) liam `reqUserRole`/`req.query.userRole` do body/query do cliente para decidir permissões — um usuário comum podia se passar por admin manipulando o payload.

**Correção:** Role sempre derivado do usuário autenticado no servidor.

**Arquivo impactado:** Todas as rotas protegidas por role

---

## 6. Upload sem Validação Real (Alto)

Validava só extensão/mimetype declarado pelo cliente.

**Correção:** Validação por magic bytes (`file-type` library) + tamanho real do buffer.

**Arquivo impactado:** Upload handlers (`server/upload`)

---

## 7. Sem Rate Limiting (Crítico)

Zero proteção contra força bruta em login/reset.

**Correção:** `express-rate-limit` (5 tentativas / 15 min) nas rotas de auth.

**Arquivo impactado:** `server/auth.ts` (login/reset-password routes)

---

## 8. Sem CORS/Helmet

**Correção:** `helmet()` + `cors()` com allowlist via `ALLOWED_ORIGINS`.

**Arquivo impactado:** `server.ts` (middleware setup)

---

## Relacionamentos

Este documento depende diretamente do [Relatório de Auditoria](../audit-report.md) (§15) que identificou cada vulnerabilidade. Para detalhes de deploy e configuração de variáveis de ambiente (`JWT_SECRET`, `ALLOWED_ORIGINS`), consulte o [Guia de Deploy](../operations/deploy-guide.md).