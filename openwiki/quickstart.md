---
type: Quickstart
title: Quickstart
description: Initial guide for developers who want to understand and work on the Fut.Manager repository.
tags: [quickstart, onboarding, development]
---

# Início Rápido

Bem-vindo ao **Fut.Manager**, um sistema de gestão para grupos de futebol society.

## Como começar

### Desenvolvimento
```bash
# instalar dependências
npm install

# iniciar o servidor em modo de desenvolvimento
npm run dev
```

### Principais Conceitos
- **Arquitetura**: O sistema é uma aplicação full-stack única (Node/Express + React). Veja a [Visão Geral da Arquitetura](/openwiki/architecture.md).
    - **Lógica de Jogadores**: Gestão de posições primárias e secundárias para escalações. Veja [/openwiki/architecture/players.md](/openwiki/architecture/players.md).
    - **Gestão de Usuários**: Fluxo de aprovação e onboarding. Veja [/openwiki/guide/user-management.md](/openwiki/guide/user-management.md).
- **Home Dinâmica**: O sistema usa uma "Home Dinâmica" que reage ao ciclo do racha. Veja detalhes em [`/openwiki/architecture/home-dynamic.md`](/openwiki/architecture/home-dynamic.md) e [`/openwiki/architecture/composer.md`](/openwiki/architecture/composer.md).
- **Operações**: O deploy é feito no Render conectado ao Supabase. Consulte [`/openwiki/operations/deploy-guide.md`](/openwiki/operations/deploy-guide.md) e [`/openwiki/operations/deploy-checklist.md`](/openwiki/operations/deploy-checklist.md).

## Estrutura da Documentação
- `architecture/`: Diagramas de arquitetura, especificações de componentes e relatórios técnicos.
- `design/`: Direção de arte, paleta de cores, tipografia e sistema visual.
- `operations/`: Guias de deploy, checklists e documentação de handoff.
- `guide/`: Manuais de fluxo de trabalho, como gestão de usuários e onboarding.

## Progressive Web App (PWA)
- [Progressive Web App (PWA) Implementation](/openwiki/architecture/pwa.md) – Manifest, service worker, and mobile integration details.

---
## Backlog
- Migrar documentação de auditoria (`docs/AUDITORIA.md`) para um formato de troubleshooting/auditoria no wiki.
- Documentar fluxo financeiro (`generateMonthlyBillingsIfNeeded`).
- Add detailed diagram of service‑worker lifecycle.
- Document how to update cache version when new assets are added.
