---
type: "Reference"
title: "Home Dynamic Engine Design"
openwiki_generated: true
---

# Home Dynamic Engine Design

Este documento estabelece a especificação completa da nova **Home Dinâmica** do **Fut.Manager**, servindo como o *blueprint* oficial para a implementação visual da Sprint 1. O design é focado na experiência mobile-first (smartphone), centralizando as decisões em torno do ciclo da rodada atual.

---

## 🗺️ FILOSOFIA DE DESIGN: "CENTRAL DA RODADA"

A Home deixa de ser uma mera coleção estática de atalhos e widgets (Dashboard) para se tornar uma interface reativa temporal. Ela responde de forma imediata e intuitiva a duas perguntas cruciais que o atleta faz ao abrir o aplicativo:

1. **"O que está acontecendo no racha agora?"**
2. **"Qual é a ação mais importante que eu preciso tomar neste exato momento?"**

---

## ETAPA 1 — INVENTÁRIO DE COMPONENTES ATUAIS

Mapeamento minucioso de todos os componentes de interface presentes na Home (`DashboardStatus.tsx`), catalogando suas regras de governança e de exibição.

| Nome do Componente | Responsabilidade | Dados Consumidos | APIs Utilizadas (Backend) | Dependências | Visível p/ Atleta | Visível p/ Admin | Pode aparecer sempre? | Condição / Estado de Exibição |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Hero Match Card** | Apresentar data, horário, local e status geral da próxima rodada com cronômetro de contagem regressiva. | Objeto `nextMatch` (id, data, local, status, reservesReleased, maxPlayers, isDeadlineExpired). | `GET /api/matches` | Nenhuma. | ✓ | ✓ | ✓ | Sempre, exceto quando não há rodada cadastrada ou aberta no sistema. |
| **CTA Confirmar Presença** | Permitir que o usuário confirme presença ("Vou"), cancele ("Não Vou") ou solicite prioridade como reserva. | `myPresence` (status do jogador logado), `currentUserCategory` (mensalista ou reserva). | `POST /api/presences` | `nextMatch` ativo. | ✓ | ✓ | ✗ | Apenas em Convocação Aberta (`CONFIRMING`) e antes do fechamento total da lista. |
| **Painel de Fila de Reserva** | Mostrar a fila ordenada de reservas, convocações ativas com limite de tempo e alertas de goleiro em falta. | `reserveQueue` (lista de prioridades, convocações ativas, histórico de chamadas, goleiro em falta). | `GET /api/matches/reserves/queue` | `nextMatch` ativo. | ✓ | ✓ | ✗ | Apenas quando há reservas interagindo ou quando a cota de mensalistas é excedida (`needsReserve = true`). |
| **Lista de Confirmados (Grid)** | Exibir os jogadores confirmados agrupados por posição e categoria de forma compacta (visualização tática). | Array `presences`, objeto de cálculo tático `computeTacticalAssignments` e lista de `players`. | `GET /api/matches/presences` | `presences` carregadas. | ✓ | ✓ | ✓ | Sempre visível como informação complementar, adaptando-se em formato estático ou dinâmico. |
| **Placar dos Times Sorteados** | Exibir os três times (Azul, Vermelho, Verde) definidos no sorteio de Monte Carlo e a escalação tática ótima. | Objeto `matchDraw` (teams, classifications, meanDiff, balances). | `GET /api/matches/draws` | `nextMatch` sorteado. | ✓ | ✓ | ✗ | Exclusivo após o sorteio ser homologado (`DRAWN` e `FINISHED`). |
| **Estatísticas e Conquistas** | Mostrar as conquistas do atleta logado (badges desbloqueadas) e estatísticas históricas do racha (OVR, gols). | Objeto `stats` do jogador logado, array `summaries`. | `GET /api/statistics`, `GET /api/achievements` | Usuário logado. | ✓ | ✓ | ✓ | Sempre, porém recolhido ou secundário em fases críticas de convocação de modo a não criar ruído tático. |
| **Destaques da Última Rodada** | Mostrar o campeão da última semana, placares das partidas jogadas e artilharia histórica da rodada anterior. | Objeto `latestResult` (scores, campeão, MVP). | `GET /api/matches/results/latest` | Dados históricos. | ✓ | ✓ | ○ | Opcional, ganha grande destaque quando não há partida iminente aberta. |
| **RSVP de Eventos Sociais** | Permitir a confirmação de presença do atleta e dependentes em churrascos e confraternizações. | Array `activeEvents`, `myParticipant`. | `POST /api/events/rsvp` | Módulo de Eventos. | ✓ | ✓ | ○ | Sempre que houver um evento ativo marcado como `confirmando` ou `agendado`. |
| **Mural de Avisos (Destaque)** | Apresentar avisos importantes, regulamentos ou posts fixados pela diretoria com mídia anexa. | Objeto `highlightPost`. | `GET /api/mural/highlight` | Canal do Mural. | ✓ | ✓ | ✓ | Sempre visível como feed de comunicação complementar, mas priorizado visualmente de acordo com a urgência. |
| **Assistente de Vinculação** | Permitir que o administrador vincule um usuário recém-aprovado a um atleta órfão no roster. | Lista `unlinkedUserToResolve`, array `players`. | `PUT /api/players/link` | Perfil administrador. | ✗ | ✓ | ✗ | Exclusivo para administradores e apenas quando há usuários sem atleta associado. |
| **Ações Rápidas do Administrador** | Botões e painéis rápidos de controle (Abrir Vagas Extras, Chamar Reservas Manuais, Encerrar Convocação). | Variáveis de status de partida. | Múltiplas APIs administrativas (`/api/matches/*`). | Perfil administrador. | ✗ | ✓ | ✗ | Exclusivo para admin e apenas em fases operacionais de preparação de rodada. |

---

## ETAPA 2 — MAPEAMENTO DOS ESTADOS DA RODADA

Identificação exaustiva de todos os estados lógicos do ecossistema do racha ao longo do ciclo semanal de uma rodada esportiva.

1. **Estado 1: Sem Rodada Aberta (`ESTADO_STANDBY`)**
   * *Ocorrência:* Logo após o encerramento da rodada anterior e antes do administrador abrir as convocações para a próxima semana.

2. **Estado 2: Convocação Aberta (`ESTADO_CONVOCACAO_ABERTA`)**
   * *Ocorrência:* A partida foi criada pelo calendário e os atletas mensalistas recebem notificações para confirmar presença.

3. **Estado 3: Presença Confirmada (`ESTADO_PRESENCA_CONFIRMADA`)**
   * *Ocorrência:* Estado individual dinâmico em que o atleta logado já confirmou que vai ao jogo, mas a lista de 15 titulares ainda está aberta.

4. **Estado 4: Convocação Encerrada (`ESTADO_LISTA_FECHADA`)**
   * *Ocorrência:* O limite de 15 jogadores confirmados (ou horário limite) foi atingido. O sistema passa ao modo de preparação de sorteio.

5. **Estado 5: Times Sorteados (`ESTADO_TIMES_SORTEADOS`)**
   * *Ocorrência:* O administrador rodou o algoritmo de Monte Carlo e os times Azul, Vermelho e Verde foram oficializados e publicados.

6. **Estado 6: Dia do Jogo (`ESTADO_DIA_DO_JOGO`)**
   * *Ocorrência:* No dia agendado do racha, algumas horas antes do apito inicial, preparando os ânimos da resenha.

7. **Estado 7: Jogo em Andamento (`ESTADO_LIVE_MATCH`)**
   * *Ocorrência:* Durante o horário programado do racha. A Home se transforma em um "Live Scoreboard" para registro de gols e vitórias em tempo real.

8. **Estado 8: Avaliações Abertas (`ESTADO_AVALIACOES_POST_JOGO`)**
   * *Ocorrência:* Imediatamente após o encerramento do jogo. Atletas são convidados a dar notas de desempenho tático uns para os outros de forma anônima.

9. **Estado 9: Resultado Publicado (`ESTADO_RESULTADO_DIVULGADO`)**
   * *Ocorrência:* Os placares e notas são processados, atualizando as estatísticas globais, tabela de artilharia e pontuações de OVR.

10. **Estado 10: Museu Atualizado (`ESTADO_MUSEU_SINCED`)**
    * *Ocorrência:* Memórias, fotos, vídeos da rodada e momentos lendários são consolidados no Museu do Clube para posteridade histórica.

---

## ETAPA 3 — MATRIZ DE VISIBILIDADE

Mapeamento rigoroso do comportamento de cada componente em cada estado para garantir foco tático máximo.

| Componente da Home | Est. 1 | Est. 2 | Est. 3 | Est. 4 | Est. 5 | Est. 6 | Est. 7 | Est. 8 | Est. 9 | Est. 10 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Hero Match Card** | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **CTA Confirmar Presença** | ✗ | ✓ | ✓ (Alterar) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Painel de Fila de Reserva** | ✗ | ○ | ○ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Lista de Confirmados (Grid)** | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Placar dos Times Sorteados** | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Estatísticas e Conquistas** | ✓ | ○ | ○ | ○ | ○ | ○ | ✗ | ✗ | ✓ | ✓ |
| **Destaques da Última Rodada**| ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| **RSVP de Eventos Sociais** | ✓ | ○ | ○ | ○ | ○ | ✓ | ✗ | ✗ | ○ | ✓ |
| **Mural de Avisos (Destaque)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ |
| **Assistente de Vinculação**  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ |
| **Ações Rápidas do Admin**    | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*Legenda:*
`✓` **Aparece:** Componente essencial no estado.
`○` **Opcional:** Aparece secundariamente ou recolhido caso o usuário expanda.
`✗` **Oculto:** Totalmente escondido para evitar distração cognitiva.

---

## 🔗 Relacionamentos

- **Dynamic Engine** (dynamic-engine.md) → é alimentado pelo contexto definido no **Composer** (composer.md);
- **Home Dynamic** (home-dynamic.md) → detalha a renderização por estado derivada da matriz de visibilidade.

---

*Documentação consolidada a partir do legado (/docs/home_dynamic_architecture.md).*