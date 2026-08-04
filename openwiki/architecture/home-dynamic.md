---
type: Especificação de Renderização Visual
title: Renderização Dinâmica Visual da Página Inicial
description: Especificação técnica de componentes de interface e matriz de visibilidade da página inicial, em função dos estados da rodada e do perfil do utilizador.
tags: [ui, ux, mobile-first, home-dynamic, state-machine]
---

# Renderização Dinâmica Visual da Página Inicial

Esta especificação detalha como a interface da página inicial reage dinamicamente ao ciclo de vida de uma rodada de futebol e ao perfil do utilizador logado. O objetivo é garantir que as informações mais críticas ("O que está a acontecer agora?" e "Qual é a minha ação?") sejam sempre as mais visíveis.

## 1. Filosofia de Design: "Central da Rodada"

A página inicial não é um dashboard estático, mas uma interface reativa que responde a duas perguntas fundamentais do atleta:
1. **"O que está a acontecer no jogo agora?"**
2. **"Qual é a ação mais importante que tenho de tomar neste exato momento?"**

A interface é concebida para dispositivos móveis (smartphones), priorizando a leitura rápida (Regra dos 3 Segundos) e evitando a sobrecarga cognitiva.

## 2. Matriz de Visibilidade por Componente e Estado

A tabela abaixo mapeia a exibição de cada componente em função do estado atual da rodada.

| Componente da Página Inicial | Em Confirmação (`CONFIRMING`) | Em Sorteio (`DRAWN`) | Dia do Jogo (`MATCH_DAY`) | Jogo em Direto (`LIVE`) | Resultado (`FINISHED`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Hero Match Card** | ✓ | ✓ | ✓ | ✓ | ✗ |
| **CTA Confirmar Presença** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Painel de Fila de Reserva** | ○ | ✓ | ✗ | ✗ | ✗ |
| **Lista de Confirmados (Grid)** | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Placar dos Times Sorteados** | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Estatísticas e Conquistas** | ✓ | ○ | ✗ | ✗ | ✓ |
| **Destaques da Última Rodada** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **RSVP de Eventos Sociais** | ✓ | ✓ | ✓ | ✗ | ○ |
| **Mural de Avisos (Destaque)** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Assistente de Vinculação** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Ações Rápidas (Admin)** | ✓ | ✓ | ✓ | ✓ | ✓ |

*Legenda: `✓` Essencial | `○` Opcional/Secundário | `✗` Oculto*

## 3. Estados da Rodada (Round States)

O comportamento da interface é determinado pelos seguintes estados lógicos do ecossistema:

1.  **`STANDBY`**: Sem rodada aberta ou período entre rodadas.
2.  **`CONFIRMING`**: Convocação aberta; mensalistas confirmando presença.
3.  **`CLOSED`**: Convocação encerrada; preparação para o sorteio.
4.  **`DRAWN`**: Times sorteados e publicados.
5.  **`MATCH_DAY`**: Dia do jogo (foco logístico e prontidão).
6.  **`LIVE`**: Jogo em direto (Live Scoreboard ativo).
7.  **`AWAITING_EVALUATION`**: Avaliações de desempenho pós-jogo abertas.
8.  **`FINISHED`**: Resultado publicado e estatísticas consolidadas.

## 4. Hierarquia Visual Mobile-First

Para garantir a usabilidade em condições de luz solar ou em movimento, aplicamos os seguintes protocolos de design:

### Regra dos 3 Segundos
Ao abrir a aplicação, o utilizador deve responder em < 3 segundos:
- **Onde estou?** (Contexto: Página Inicial Dinâmica)
- **O que aconteceu?** (Ex: Convocação iniciada para quarta-feira)
- **O que preciso fazer?** (Ex: Clicar em "Confirmar Presença")
- **Qual é a minha situação?** (Ex: Pendente / Confirmado)
- **Tempo restante?** (Ex: Fechamento em 14h 32m)

### Protocolo de Interface
- **Mobile-First:** Foco em menos de 100vh de scroll para as ações principais.
- **Transições de Estado:** Utilização de animações suaves (`motion/react`) para transições de módulos (layout staggered de 300ms), evitando recarregamentos de página.
- **Acessibilidade Tátil:** Botões com `min-height: 44px` para dispositivos com `pointer: coarse`.

---
*Documentação consolidada a partir do legado (/docs/home_dynamic_architecture.md).*