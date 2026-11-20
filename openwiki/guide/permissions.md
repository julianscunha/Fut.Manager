---
type: Guia
title: Permissões do Sistema
description: Funções (roles) do Fut.Manager, hierarquia de acesso, capacidades de cada perfil e mapeamento entre função e categoria de atleta.
tags: [permissões, funções, controle-de-acesso, admin, auxiliar, jogador]
---

# Permissões do Sistema

O Fut.Manager utiliza um sistema baseado em três funções (roles) definidas pelo tipo `UserRole` (`src/types/domain.ts:6`). Cada função determina as ações que um usuário pode realizar na plataforma, tanto no servidor (API) quanto no cliente (interface).

---

## Hierarquia de Funções

| Função | Rótulo na Interface | Nível de Acesso |
|---------|-------------------|-----------------|
| `admin` | Administrador | Total |
| `auxiliar` | Assistente Técnico | Elevado |
| `jogador` | Atleta | Limitado (apenas ao próprio perfil) |

O `admin` é a função principal e não pode ser removido do único administrador ativo (proteção em `server.ts:1023-1032`).

---

## Matriz de Permissões

### Gestão de Atletas (Players)

| Ação | `admin` | `auxiliar` | `jogador` |
|-------|:--------:|:----------:|:---------:|
| Listar todos os atletas (`GET /api/players`) | ✅ | ✅ | ✅ |
| Criar atleta manualmente (`POST /api/players`) | ✅ | ❌ | ❌ |
| Gerar atletas aleatórios (`POST /api/players/generate-random-10`) | ✅ | ✅ | ❌ |
| Editar próprio perfil (`PUT /api/players/:id`) | ✅ | ✅ | ✅ (apenas ao próprio) |
| Editar perfil de terceiros | ✅ | ❌ | ❌ |
| Inativar atleta (`DELETE /api/players/:id`) | ✅ | ❌ | ❌ |
| Reativar atleta (`POST /api/players/:id/restore`) | ✅ | ❌ | ❌ |
| Ver logs de transição de categoria (`GET /api/players/:id/transitions`) | ✅ | ✅ | ✅ (próprio) |
| Gerar cartão/espécie (`POST /api/players/:id/generate-card`) | ✅ | ✅ | ❌(?) |

### Avaliações e Desempenho

| Ação | `admin` | `auxiliar` | `jogador` |
|-------|:--------:|:----------:|:---------:|
| Ver estatísticas gerais (`GET /api/stats`) | ✅ | ✅ | ✅ |
| Ver resumo de avaliações (`GET /api/evaluations/summary`) | ✅ | ✅ | ✅ |
| Ver avaliações de um jogador (`GET /api/players/:id/evaluations`) | ✅ | ✅ | ✅ |
| Avaliar jogador (`POST /api/players/:id/evaluate`) | ✅ | ✅ | ✅ |
| Ver resultados (`GET /api/results`) | ✅ | ✅ | ✅ |

### Calendário e Sorteio

| Ação | `admin` | `auxiliar` | `jogador` |
|-------|:--------:|:----------:|:---------:|
| Ver partidas (`GET /api/matches`) | ✅ | ✅ | ✅ |
| Criar partida (`POST /api/matches`) | ✅ | ✅ | ❌ |
| Confirmar presença (`POST /api/matches/:id/presences/toggle`) | ✅ | ✅ | ✅ |
| Limpar presenças (`POST /api/matches/:id/clear-presences`) | ✅ | ✅ | ❌ |
| Liberar reservas (`POST /api/matches/:id/release-reserves`) | ✅ | ✅ | ❌ |

Quando um novo jogador recebe uma função específica através do painel de Administração → Acesso de Contas, essa função é automaticamente refletida no perfil dele, graças à busca do usuário vinculado por `playerId` ou e-mail.

---

## Arquivos Principais

| Arquivo | Conteúdo |
|---------|---------|
| `src/types/domain.ts:6` | Definição do tipo `UserRole` |
| `server.ts:939-941` | Proteção da rota `GET /api/users` (admin/auxiliar) |
| `server.ts:1451-1452` | Proteção da rota `POST /api/players` (apenas admin) |
| `server.ts:1470-1471` | Proteção da rota `PUT /api/players/:id` (admin vs auto) |
| `server.ts:1969-1971` | Proteção da rota `DELETE /api/players/:id` (apenas admin) |
| `server.ts:1023-1032` | Proteção contra remoção do último admin |
| `server.ts:636` | Mapeamento de função para categoria na vinculação |
| `src/App.tsx` | Lógica de busca do `playerRole` no perfil |
| `src/components/PlayerHero.tsx` | Exibição das badges de categoria e função |