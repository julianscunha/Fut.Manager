# FASE 2 — UX/UI ESPORTIVO
# ETAPA 1 — INVENTÁRIO E ARQUITETURA DA HOME DINÂMICA

Este documento estabelece a especificação completa da nova **Home Dinâmica** do **Racha do Fofim**, servindo como o *blueprint* oficial para a implementação visual da Sprint 1. O design é focado na experiência mobile-first (smartphone), centralizando as decisões em torno do ciclo da rodada atual.

---

## 🗺️ FILOSOFIA DE DESIGN: "CENTRAL DA RODADA"
A Home deixa de ser uma mera coleção estática de atalhos e widgets (Dashboard) para se tornar uma interface reativa temporal. Ela responde de forma imediata e intuitiva a duas perguntas cruciais que o atleta faz ao abrir o aplicativo:
1. **"O que está acontecendo no racha agora?"**
2. **"Qual é a ação mais importante que eu preciso tomar neste exato momento?"**

---

## ETAPA 1 — INVENTÁRIO DE COMPONENTES ATUAIS

Mapeamento minucioso de todos os componentes de interface presentes na Home (`DashboardStatus.tsx`), catalogando suas regras de governança e de exibição.

| Nome do Componente | Responsabilidade | Dados Consumidos | APIs Utilizadas (Backend) | Dependências | Visível p/ Atleta | Visível p/ Admin | Pode aparecer sempre? | Condição / Estado de Exibição |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
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

## ETAPA 4 — HIERARQUIA VISUAL MOBILE-FIRST

Especificação estrutural para telas de smartphones, priorizando a densidade e o foco de atenção em menos de 100vh de scroll.

### Estado 1: Sem Rodada Aberta (`ESTADO_STANDBY`)
* **Elemento Primário:** Resumo e Troféus da Última Rodada (Efeito Glória da Vitória).
* **Elemento Secundário:** Próximo Evento Social Cadastrado (Ex: Churrasco Oficial de Fim de Mês).
* **Elemento Terciário:** Feed do Mural de Avisos da Diretoria.
* **Ação Principal (CTA):** "Ver Minhas Conquistas Históricas" (Redirecionamento para Ranking).
* **Informação Crítica:** Mensagem "Nenhuma partida agendada. Aguardando convocação da diretoria."
* **Informações Complementares:** Alertas de pendências financeiras mensais.

### Estado 2: Convocação Aberta (`ESTADO_CONVOCACAO_ABERTA`)
* **Elemento Primário:** Card Hero Match de Contagem Regressiva para a Partida.
* **Elemento Secundário:** Painel Central Dinâmico de Confirmação (CTA).
* **Elemento Terciário:** Grid Visual de Vagas Restantes (15 Slots).
* **Ação Principal (CTA):** Botão Gigante de Confirmação: **"VOU JOGAR! ⚽"** (Verde esmeralda pulsante).
* **Informação Crítica:** Quantidade de vagas abertas restantes de mensalistas.
* **Informações Complementares:** Localização exata com link para mapa do asfalto/quadra.

### Estado 3: Presença Confirmada (`ESTADO_PRESENCA_CONFIRMADA`)
* **Elemento Primário:** Status do Atleta: **"Você está confirmado!"** com badge de Pontualidade garantida.
* **Elemento Secundário:** Grid de Lista de Presença mostrando os outros atletas confirmados e suas posições.
* **Elemento Terciário:** Alerta de vagas remanescentes ou fila de reservas se iniciando.
* **Ação Principal (CTA):** Botão discreto de cancelamento / troca de resposta: **"Preciso Cancelar"** (Visual sóbrio e preventivo).
* **Informação Crítica:** "Faltam apenas X confirmados para iniciar o sorteio de Monte Carlo."
* **Informações Complementares:** Distribuição tática parcial (Ex: 1 GK, 3 Defensores confirmados).

### Estado 4: Convocação Encerrada (`ESTADO_LISTA_FECHADA`)
* **Elemento Primário:** Status de Espera: **"Convocação Concluída. Lista Fechada!"**
* **Elemento Secundário:** Painel de Fila de Reservas (Prioridade e status das chamadas).
* **Elemento Terciário:** Grid Tático de Confirmados para o jogo (Os 15 oficiais da rodada).
* **Ação Principal (CTA):** *Para Atleta:* Nenhuma (Aguardar sorteio). *Para Admin:* **"Realizar Sorteio de Equipes"** (Destaque administrativo discreto).
* **Informação Crítica:** Alerta se houver falta de goleiro na lista de confirmados.
* **Informações Complementares:** Histórico das últimas convocações de reservas.

### Estado 5: Times Sorteados (`ESTADO_TIMES_SORTEADOS`)
* **Elemento Primário:** Visualizador Triplo de Equipes Sorteadas (Abas horizontais de fácil deslize: Azul, Vermelho, Verde).
* **Elemento Secundário:** Comparativo Técnico do Sorteio (Diferença média de OVR).
* **Elemento Terciário:** Badges táticas de adaptação de posição (Ex: Zagueiro improvisado na Lateral).
* **Ação Principal (CTA):** **"Compartilhar Escalações"** (Gera imagem limpa ou texto formatado para envio no grupo do WhatsApp).
* **Informação Crítica:** O time no qual o atleta logado foi escalado (destaque brilhante com borda dourada).
* **Informações Complementares:** Alertas de pontualidade e regras para o dia de jogo.

---

## ETAPA 5 — EXPERIÊNCIA DO ATLETA (REGRA DOS 3 SEGUNDOS)

Validação de usabilidade para garantir leitura rápida sem esforço sob luz do sol ou no trânsito.

```
+-------------------------------------------------------------------+
| RECORTE COGNITIVO EM 3 SEGUNDOS:                                  |
|                                                                   |
| 1. Onde estou? --------> Home Dinâmica do Racha do Fofim          |
| 2. O que aconteceu? ----> Convocação iniciou para quarta-feira    |
| 3. O que preciso fazer? -> Clicar em "Confirmar Presença"         |
| 4. Qual minha situação? -> Pendente (Não confirmado ainda)        |
| 5. Tempo restante? ------> Fechamento em 14h 32m                  |
+-------------------------------------------------------------------+
```

### Protocolo de Validação dos Estados Principais:

* **Na Convocação Aberta:**
  * Atleta abre o app: Vê imediatamente o card pulsando em verde.
  * Resposta em 1 segundo: "Tem jogo quarta-feira!"
  * Resposta em 2 segundos: "Eu ainda não respondi. Preciso clicar no botão."
  * Resposta em 3 segundos: "Restam apenas 3 vagas de mensalista!"

* **Nos Times Sorteados:**
  * Atleta abre o app: Vê uma tela dividida em 3 colunas de cores vibrantes.
  * Resposta em 1 segundo: "Os times já saíram!"
  * Resposta em 2 segundos: "Eu estou no Time Azul!"
  * Resposta em 3 segundos: "Vou jogar de Meio-Campo ao lado do João."

* **No Dia do Jogo:**
  * Atleta abre o app: Vê o cronômetro zerando e as coordenadas da quadra.
  * Resposta em 1 segundo: "É hoje!"
  * Resposta em 2 segundos: "Começa às 19:30 na Quadra Principal."
  * Resposta em 3 segundos: "Não posso atrasar para não perder a pontualidade."

---

## ETAPA 6 — EXPERIÊNCIA DO ADMINISTRADOR (ESTRUTURA SILENCIOSA)

Os controles administrativos devem ser invisíveis para o atleta comum e discretos para o gestor, evitando o efeito de "painel industrial corporativo".

1. **FAB (Floating Action Button) de Contexto:**
   * Um botão circular discreto no canto inferior direito, visível apenas para admins.
   * Ao clicar, abre um menu radial limpo:
     * ➕ Criar Rodada Extra
     * 🎲 Forçar Sorteio
     * 📢 Publicar Aviso Rápido

2. **Atalhos Administrativos Invisíveis:**
   * No próprio card Hero, se o usuário for admin, ícones sutis de engrenagem ou edição aparecem ao lado de textos críticos.
   * Exemplo: Clicar no contador de confirmados abre instantaneamente o modal de controle de lista (Adicionar jogador manualmente, liberar vagas de reserva).

3. **Painéis Recolhíveis (Collapsible Drawer):**
   * Ferramentas pesadas como o "Assistente de Vinculação de Usuários" ou "Análise Estatística da Fila de Espera" ficam guardadas dentro de acordeões colapsados na parte inferior da tela, rotulados estritamente como `⚙️ Painel Operacional`.

---

## ETAPA 7 — TRANSIÇÕES DE ESTADO DINÂMICAS

O sistema utiliza arquitetura SPA e reatividade de estado para garantir transições suaves sem carregamentos de tela bruscos.

```
[ESTADO LÓGICO: CONFIRMANDO]
       │
       ├─► Atleta clica em "Vou"
       │         │
       │         ▼ (Animação Fade-Out do CTA Confirmação)
       │         ▼ (Animação Staggered-In do Grid de Confirmados)
       │
       ├─► [SISTEMA DETECTA 15 CONFIRMADOS]
       │         │
       │         ▼ (Transição Suave de Cor do Hero: Verde -> Âmbar)
       │         ▼ (Oculta CTA de Presença)
       │         ▼ (Exibe Fila de Reservas para novos entrantes)
       │
       ▼
[ESTADO LÓGICO: CLOSED (Aguardando Sorteio)]
```

* **Micro-animações de Transição (`motion/react`):**
  * **Fade-in/Fade-out** de 300ms na alteração de CTAs ativos para evitar saltos visuais estruturais.
  * **Deslocamento lateral (Slide-X)** ao alternar entre as abas dos times sorteados no mobile, imitando a navegação natural de aplicativos esportivos nativos.

---

## ETAPA 8 — ESPECIFICAÇÃO FINAL E ARQUITETURA

### 📋 Fluxograma Textual do Ciclo da Rodada

```
+--------------------+      Convocação Ativada      +--------------------+
| 1. STANDBY         | ────────────────────────────►| 2. CONV_ABERTA     |
+--------------------+                              +--------------------+
          ▲                                                    │
          │                                                    ├─► Confirma Presença
          │                                                    ▼
          │                                         +--------------------+
          │                                         | 3. PRES_CONFIRMADA |
          │                                         +--------------------+
          │                                                    │
          │                                                    ├─► Lista com 15
          │                                                    ▼
          │                                         +--------------------+
          │                                         | 4. LISTA_FECHADA   |
          │                                         +--------------------+
          │                                                    │
          │                                                    ├─► Roda Sorteio
          │                                                    ▼
          │                                         +--------------------+
          │                                         | 5. TIMES_SORTEADOS |
          │                                         +--------------------+
          │                                                    │
          │                                                    ├─► Data Agendada
          │                                                    ▼
          │                                         +--------------------+
          │                                         | 6. DIA_DO_JOGO     |
          │                                         +--------------------+
          │                                                    │
          │                                                    ├─► Horário de Jogo
          │                                                    ▼
          │      Acervo Sincronizado                +--------------------+
          ├─────────────────────────────────────────| 7. JOGO_LIVE       |
          │                                         +--------------------+
          │                                                    │
          │                                                    ├─► Jogo Concluído
          │                                                    ▼
+--------------------+      Pontuações Divulgadas   +--------------------+
| 9. RESULT_PUB      |◄─────────────────────────────| 8. AVALIACOES_POST |
+--------------------+                              +--------------------+
```

### 🧠 Justificativas de UX (User Experience Design)

1. **Prevenção de Ansiedade Tática (Etapas 3 e 5):**
   * Ao ocultar as estatísticas gerais e a galeria de fotos durante a fase de convocação aberta, o cérebro do atleta se foca exclusivamente em responder à convocação. Menos ruído visual resulta em maior velocidade de resposta e menor atraso na lista de presença.

2. **Reforço de Identidade Tática:**
   * Agrupar a lista de presença por posições (Goleiros, Defensores, Meias, Atacantes) em vez de uma lista alfabética simples simula visualmente uma prancheta de treinador, estimulando o espírito esportivo antes mesmo de entrar no asfalto.

3. **Neutralidade por Monte Carlo:**
   * Exibir as estatísticas de desvio de OVR de forma transparente pós-sorteio destrói qualquer suspeita de manipulação ou "panela" armada pela diretoria, sustentando a integridade regulamentar.

4. **Assinatura e Governança:**
   * A separação física de painéis operacionais do administrador garante que a Home mantenha um visual de "App de Jogador" — limpo, focado em alta legibilidade tática, cores contrastantes (escala de grafite escura e acentos de verde esmeralda e âmbar) e excelente leitura móvel.

---

Este blueprint de arquitetura está formalmente homologado e pronto para servir de base direta para as transformações de interface visual na Sprint 1 da Fase 2.
