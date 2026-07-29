---
type: Guide
title: Permissões do Sistema
description: Papéis (roles) do Fut.Manager, hierarquia de acesso, capacidades de cada perfil e mapeamento entre role e category de atleta.
tags: [permissions, roles, access-control, admin, auxiliar, jogador]
---

# Permissões do Sistema

O Fut.Manager utiliza um sistema de três papéis (roles) baseado no tipo `UserRole` (`src/types.ts:6`). Cada role determina o que o usuário pode fazer na plataforma, tanto no lado da API (servidor) quanto na interface (cliente).

---

## Hierarquia de Roles

| Role | Label na UI | Nível de Acesso |
|------|-------------|-----------------|
| `admin` | Administrador | Total |
| `auxiliar` | Auxiliar Técnico | Elevado |
| `jogador` | Atleta | Limitado (próprio perfil) |

O `admin` é o papel raiz — não pode ser removido do único administrador ativo (proteção no `server.ts:1023-1032`).

---

## Capability Matrix

### Gestão de Atletas (Players)

| Ação | `admin` | `auxiliar` | `jogador` |
|------|:-------:|:----------:|:---------:|
| Listar todos os atletas (`GET /api/players`) | ✅ | ✅ | ✅ |
| Criar atleta manualmente (`POST /api/players`) | ✅ | ❌ | ❌ |
| Gerar atletas aleatórios (`POST /api/players/generate-random-10`) | ✅ | ✅ | ❌ |
| Editar próprio perfil (`PUT /api/players/:id`) | ✅ | ✅ | ✅ (apenas o próprio) |
| Editar atleta de terceiros | ✅ | ❌ | ❌ |
| Inativar atleta (`DELETE /api/players/:id`) | ✅ | ❌ | ❌ |
| Reativar atleta (`POST /api/players/:id/restore`) | ✅ | ❌ | ❌ |
| Ver logs de transição de categoria (`GET /api/players/:id/transitions`) | ✅ | ✅ | ✅ (próprio) |
| Gerar card/esportivo (`POST /api/players/:id/generate-card`) | ✅ | ✅ | ❌(?) |

### Avaliações e Performance (Ranking)

| Ação | `admin` | `auxiliar` | `jogador` |
|------|:-------:|:----------:|:---------:|
| Ver stats gerais (`GET /api/stats`) | ✅ | ✅ | ✅ |
| Ver resumo de avaliações (`GET /api/evaluations/summary`) | ✅ | ✅ | ✅ |
| Ver avaliações de um jogador (`GET /api/players/:id/evaluations`) | ✅ | ✅ | ✅ |
| Avaliar jogador (`POST /api/players/:id/evaluate`) | ✅ | ✅ | ✅ |
| Ver resultados (`GET /api/results`) | ✅ | ✅ | ✅ |

### Calendário e Sorteio (Matches & Draws)

| Ação | `admin` | `auxiliar` | `jogador` |
|------|:-------:|:----------:|:---------:|
| Ver partidas (`GET /api/matches`) | ✅ | ✅ | ✅ |
| Criar partida (`POST /api/matches`) | ✅ | ✅ | ❌ |
| Confirmar presença (`POST /api/matches/:id/presences/toggle`) | ✅ | ✅ | ✅ |
| Limpar presenças (`POST /api/matches/:id/clear-presences`) | ✅ | ✅ | ❌ |
| Liberar reservas (`POST /api/matches/:id/release-reserves`) | ✅ | ✅ | ❌ |
| Realizar sorteio (`POST /api/matches/:id/draw`) | ✅ | ✅ | ❌ |
| Re-sortear (`POST /api/matches/:id/draw` com redraw) | ✅ | ❌ | ❌ |
| Registrar resultado (`POST /api/matches/:id/results`) | ✅ | ✅ | ❌ |
| Arquivar partida (`POST /api/matches/:id/archive`) | ✅ | ❌ | ❌ |
| Excluir partida (`DELETE /api/matches/:id`) | ✅ | ❌ | ❌ |

### Usuários e Permissões (User Management)

| Ação | `admin` | `auxiliar` | `jogador` |
|------|:-------:|:----------:|:---------:|
| Listar usuários (`GET /api/users`) | ✅ | ✅ | ❌ |
| Ver auditoria de usuários (`GET /api/users/audits`) | ✅ | ✅ | ❌ |
| Aprovar/rejeitar cadastros (`POST /api/users/action`) | ✅ | ❌ | ❌ |
| Alterar role de usuário (`POST /api/users/action` com `update_role`) | ✅ | ❌ | ❌ |
| Ver logs de prazos (`GET /api/deadline-audits`) | ✅ | ✅ | ❌ |

### Museu e Mural (Social)

| Ação | `admin` | `auxiliar` | `jogador` |
|------|:-------:|:----------:|:---------:|
| Ver posts do mural (`GET /api/mural/posts`) | ✅ | ✅ | ✅ |
| Criar post (`POST /api/mural/posts`) | ✅ | ✅ | ✅ |
| Editar post próprio (`PUT /api/mural/posts/:id`) | ✅ | ✅ | ✅ |
| Editar post de terceiros | ✅ | ❌ | ❌ |
| Destacar/fixar post | ✅ | ❌ | ❌ |
| Excluir post | ✅ | ❌ | ❌ |

### Eventos e Financeiro

| Ação | `admin` | `auxiliar` | `jogador` |
|------|:-------:|:----------:|:---------:|
| Criar evento (`POST /api/events`) | ✅ | ❌ | ❌ |
| Visualizar eventos (`GET /api/events`) | ✅ | ✅ | ✅ |
| Confirmar presença em evento | ✅ | ✅ | ✅ |
| Pagar cobrança (`POST /api/finances/pay`) | ✅ | ✅ (admin/auxiliar) | ✅ (própria conta) |
| Configurar finanças (`POST /api/finances/config`) | ✅ | ❌ | ❌ |
| Listar finanças (`GET /api/finances`) | ✅ | ✅ | ✅ |

---

## Mapeamento Role → Athlete Category

Quando um `User` é aprovado e vinculado a um `Player` no banco, a categoria do atleta é definida automaticamente pelo role (`server.ts` via `db.ts:636`):

| `UserRole` | `Player.category` | Prioridade no racha |
|------------|-------------------|---------------------|
| `admin` | `mensalista` | Garante vaga |
| `auxiliar` | `reserva` | Cubre vagas após mensalistas |
| `jogador` | `reserva` | Cubre vagas após mensalistas |

> **Nota:** Essa atribuição é feita apenas no momento da vinculação. Alterar o `role` de um `User` posteriormente **não** muda automaticamente o `category` do `Player` vinculado — isso exige ação manual via Admin.

---

## Display no Perfil do Atleta (`PlayerHero.tsx`)

A tela de perfil do jogador exibe duas badges na barra superior:

1. **Categoria do atleta** — derivada de `player.category` (`mensalista` → "Mensalista", `reserva` → "Reserva")
2. **Permissão (role)** — derivada do `User` vinculado ao jogador (`admin` → "Administrador", `auxiliar` → "Auxiliar", `jogador` → "Jogador")

Quando um novo jogador recebe uma permissão específica via Administração → Acesso de Contas, essa permissão é refletida automaticamente no perfil dele graças à busca do `User` vinculado por `playerId` ou e-mail.

---

## Arquivos-chave

| Arquivo | O que contém |
|---------|-------------|
| `src/types.ts:6` | Definição do tipo `UserRole` |
| `server.ts:939-941` | Proteção de `GET /api/users` (admin/auxiliar) |
| `server.ts:1451-1452` | Proteção de `POST /api/players` (admin only) |
| `server.ts:1470-1471` | Proteção de `PUT /api/players/:id` (admin vs auto) |
| `server.ts:1969-1971` | Proteção de `DELETE /api/players/:id` (admin only) |
| `server.ts:1023-1032` | Proteção de não remover o último admin |
| `server.ts:636` | Mapeamento `role → category` na vinculação |
| `src/App.tsx` | Lógica de lookup do `playerRole` no perfil |
| `src/components/PlayerHero.tsx` | Exibição das badges de categoria e permissão |