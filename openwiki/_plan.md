---
type: Plan
title: Atualização de Sincronização Código-Wiki
description: Plano para atualizar a documentação para refletir novas funcionalidades de e-mail, posições de jogadores e aprovação de usuários.
tags: [planning, sync, documentation]
---

# Plano de Atualização da Wiki

## 1. Páginas a serem Atualizadas/Criadas

### /openwiki/architecture.md (Atualização)
- **Adicionar**: Seção sobre o Sistema de Notificações/E-mails.
- **Relacionamento**: `server.ts` -> `dispara` -> `server/email.ts` -> `usa` -> `server/email-templates/`.
- **Evidência**: Novos arquivos em `server/email-templates/` e rotas admin em `server.ts`.

### /openwiki/architecture/players.md (Nova Página)
- **Conteúdo**: Documentar a lógica de posições (`primaryPosition` vs `secondaryPositions`).
- **Detalhe**: Explicar como `getAllStarTeam` e `getBestKeeper` utilizam essas posições para evitar erros de escalação (ex: zagueiro como GK).
- **Evidência**: `src/components/DashboardStatus.tsx`.

### /openwiki/guide/user-management.md (Nova Página)
- **Conteúdo**: Fluxo de cadastro $\rightarrow$ aprovação $\rightarrow$ e-mail de boas-vindas.
- **Componente**: `UserApprovalList.tsx`.
- **Relacionamento**: `Admin` -> `aprova` -> `Usuário` -> `recebe` -> `Welcome Email`.

### /openwiki/source-map.md (Atualização)
- Atualizar a lista de arquivos para incluir explicitamente `server/email-templates/` e a nova página de gestão de usuários.

## 2. Relacionamentos Semânticos (OKF)
- `User Management` $\rightarrow$ `depende de` $\rightarrow$ `Auth System`
- `User Management` $\rightarrow$ `dispara` $\rightarrow$ `Email Templates`
- `Player Logic` $\rightarrow$ `influencia` $\rightarrow$ `Dashboard Status`

## 3. Checklist de Validação
- [ ] Verificar se as rotas de admin de e-mail estão documentadas.
- [ ] Garantir que a distinção entre posições primárias e secundárias esteja clara.
- [ ] Adicionar diagrama Mermaid do fluxo de aprovação de usuário.
