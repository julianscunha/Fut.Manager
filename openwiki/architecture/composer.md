---
type: "Reference"
title: "Esboço da Arquitetura do Home Composer"
openwiki_generated: true
---

# Home Composer Architecture Blueprint

Este documento estabelece o blueprint definitivo e a especificação de arquitetura de software para o **Home Composer**, a engine de composição tridimensional inteligente que orquestra a experiência da Home Page do **Fut.Manager**.

---

## 🏗️ 1. CONCEITO DO HOME COMPOSER

A Home deixa de possuir lógica visual complexa e condicionais aninhadas (`if-else` ou ternários espalhados) em sua árvore de renderização. Em vez disso, ela é tratada como um canvas composto de módulos independentes acoplados de forma declarativa baseado em três dimensões de contexto dinâmico:

```
            +───────────────────────────+
            │    ESTADO DA RODADA       │  (Fase do calendário semanal)
            +─────────────┬─────────────+
                          │
                          ▼
            +───────────────────────────+
            │   ESTADO DO ATLETA        │  (Presença, escalação, suspensão)
            +─────────────┬─────────────+
                          │
                          ▼
            +───────────────────────────+
            │    PERFIL DO USUÁRIO      │  (Atleta regular vs Administrador)
            +─────────────┬─────────────+
                          │
                          ▼
            +───────────────────────────+
            │   COMPOSIÇÃO DE COMPONENTES│  (HomeComposer Engine)
            +───────────────────────────+
```

---

## 🗂️ 2. DIMENSÕES DE CONTEXTO DO COMPOSER

### Dimensão A: Estado da Rodada (Round State)

Definido pelo status global do campeonato no backend:

| Estado | Descrição | Contexto |
|--------|------------|----------|
| **`STANDBY`** | Sem rodada aberta / Período entre rodadas. | A Home exibe painel de carregamento + ranking geral do mês. |
| **`CONFIRMING`** | Convocação aberta, mensalistas confirmando. | A Home mostra CTA para confirmar presença + painel de vagas. |
| **`CLOSED`** | Convocação encerrada, preparando sorteio. | A Home exibe contagem regressiva para o sorteio + botões administrativos. |
| **`DRAWN`** | Times sorteados e publicados. | A Home mostra a composição dos times sortudos e "Meu Time". |
| **`MATCH_DAY`** | Dia do jogo (horas antes do início). | A Home ativa checklist do dia do jogo + mapa de localização. |
| **`LIVE`** | Jogo em andamento (Live Scoreboard ativo). | A Home reproduz placar ao vivo + estatísticas do jogo. |
| **`AWAITING_EVALUATION`** | Avaliações de desempenho pós-jogo abertas. | A Home convida o atleta a avaliar seus companheiros. |
| **`FINISHED`** | Resultado publicado, estatísticas consolidadas. | A Home exibe resultados consolidados, "Destaques da Rodada" + link do Museu. |

### Dimensão B: Estado Individual do Atleta (Athlete State)

Definido pelo status do jogador logado em relação à rodada:

1. **`PENDING`** – Não respondeu à convocação.
2. **`CONFIRMED`** – Presença confirmada na lista de titulares.
3. **`RESERVE_WAITING`** – Na fila de espera / Fila de reservas.
4. **`RESERVE_CALLED`** – Convocado da reserva (aguardando aceite).
5. **`DECLINED`** – Recusou a convocação para esta rodada.
6. **`SUSPENDED`** – Suspenso temporariamente pela diretoria.
7. **`INJURED`** – Afastado por lesão (marcado como DM).
8. **`GUEST`** – Convidado avulso (não mensalista cadastrado).

### Dimensão C: Perfil do Usuário (User Role)

Definido pelas credenciais de controle do usuário:

1. **`ATHLETE`** – Perfil regular, focado na experiência esportiva pura.
2. **`ADMIN`** – Diretor/Organizador, com privilégios de controle silencioso.

---

## 🎚️ 3. MATRIZ TRIDIMENSIONAL DE COMPOSIÇÃO DE INTERFACE

Abaixo, a especificação das telas que o `HomeComposer` montará para cada combinação chave de contextos:

| Contexto da Rodada | Contexto do Atleta | Perfil | Componentes Exibidos na Home |
| :--- | :--- | :---: | :--- |
| **`STANDBY`** | Qualquer | Atleta | `HomeHero` (Vazio) + `HomeEstatisticas` + `HomeRanking` + `HomeAvisos` |
| **`STANDBY`** | Qualquer | Admin | `HomeHero` (Vazio) + `HomeEstatisticas` + `HomeRanking` + `HomeAvisos` + `HomeAdminTools` (FAB) |
| **`CONFIRMING`** | `PENDING` | Atleta | `HomeHero` (Modular: Convocação) + `HomeCTA` (Confirmar) + `HomeConfirmados` + `HomeAvisos` |
| **`CONFIRMING`** | `CONFIRMED` | Atleta | `HomeHero` (Modular: Confirmado) + `HomeCTA` (Cancelar) + `HomeConfirmados` + `HomeConquistas` |
| **`CONFIRMING`** | `PENDING` | Admin | `HomeHero` (Modular: Convocação) + `HomeCTA` (Confirmar) + `HomeConfirmados` + `HomeAvisos` + `HomeAdminTools` |
| **`CLOSED`** | `RESERVE_WAITING`| Atleta | `HomeHero` (Modular: Espera) + `HomeReserva` (Posição Fila) + `HomeConfirmados` + `HomeAvisos` |
| **`CLOSED`** | `CONFIRMED` | Atleta | `HomeHero` (Modular: Titular) + `HomeConfirmados` + `HomeRanking` + `HomeAvisos` |
| **`DRAWN`** | `CONFIRMED` | Atleta | `HomeHero` (Modular: Escalado) + `HomeMeuTime` (Destaque) + `HomeTimesLista` (Abas) |
| **`DRAWN`** | `RESERVE_WAITING`| Atleta | `HomeHero` (Modular: Reserva) + `HomeTimesLista` (Abas) + `HomeAvisos` |
| **`MATCH_DAY`** | `CONFIRMED` | Atleta | `HomeHero` (Modo Dia do Racha) + `HomeMeuTime` + `HomeMatchChecklist` + `HomeMapsWaze` |
| **`LIVE`** | Qualquer | Atleta | `HomeHero` (Live Scoreboard) + `HomeLiveStats` + `HomeMuralLive` |
| **`AWAITING_EVALUATION`** | `CONFIRMED` | Atleta | `HomeHero` (Pendência) + `HomePlayerEvaluation` (Foco) + `HomeEstatisticas` |
| **`FINISHED`** | Qualquer | Atleta | `HomeHero` (Consolidado) + `HomeDestaquesRodada` + `HomeMuseu` + `HomeConquistas` |

---

## 🎨 4. ARQUITETURA MODULAR DO HERO (HERO COMPOSER)

O Hero deixa de ser um bloco de código monolítico. Ele passa a ser composto por três camadas desacopladas e empilháveis, minimizando repetição de código e maximizando flexibilidade:

```
┌───────────────────────────────────────────────────────────┐
│ 1. CAMADA PERMANENTE                                      │
│    [Fut.Manager - Rodada #42]                         │
│    Data: Quarta, 19:30 | Arena Principal                 │
├───────────────────────────────────────────────────────────┤
│ 2. CAMADA CONTEXTUAL (Fase da Rodada)                    │
│    ⏳ Convocação aberta! Termina em 14h 32m               │
├───────────────────────────────────────────────────────────┤
│ 3. CAMADA INDIVIDUAL (Situação do Atleta)                 │
│    🟢 Você já garantiu sua vaga! Nível de Pontualidade: 95%│
└───────────────────────────────────────────────────────────┘
```

### Camada 1: Permanente
Exibe os dados imutáveis da rodada atual, independentemente do status do jogador:
* ID/Número da Rodada.
* Data e Horário Oficial do início.
* Localização da Arena/Quadra.

### Camada 2: Contextual
Apresenta o status regulamentar e o tempo limite correspondente:
* **Fase de Convocação:** Cronômetro regressivo para o fechamento da lista.
* **Fase de Sorteio:** Alerta de equipes oficializadas.
* **Fase de Dia de Jogo:** Temperatura e clima local integrados.
* **Fase de Rescaldo:** Quantidade de avaliações concluídas do elenco.

### Camada 3: Individual
Customizada sob medida para o ID do atleta ativo na sessão:
* **Se Confirmado:** Badge de confirmação rápida e horário sugerido de chegada.
* **Se na Reserva:** Número exato de prioridade na fila de espera com estimativa de entrada.
* **Se Suspenso:** Motivo detalhado e link direto para regularização financeira/disciplinar.
* **Se com Avaliação Pendente:** Botão de chamada ativa para avaliar os companheiros.

---

## 🚀 5. EXPERIÊNCIA DOS TIMES SORTEADOS: "MEU TIME EM 1º LUGAR"

Quando o sorteio por Monte Carlo é publicado (`Estado: DRAWN`), o atleta não deve ser bombardeado com listas genéricas de todos os times. O Composer aplica a regra da **Prioridade Personalizada**:

1. **Card Destaque: ⭐ MEU TIME**
   * O sistema lê o ID do jogador logado e identifica em qual equipe (Azul, Vermelho ou Verde) ele foi escalado.
   * Apresenta o time do atleta em destaque gigante na interface, com a cor da camisa correspondente e o escudo tático.
   * **Atributos de Engajamento:**
     * Posição tática em que jogará nesta rodada.
     * Companheiros de linha e goleiro oficial.
     * OVR médio consolidado da equipe.

2. **Navegação Horizontal Integrada (Swipe / Carousel):**
   * Somente após o destaque pessoal, o usuário pode deslizar lateralmente para inspecionar os times concorrentes.
   * **Estrutura de Abas Deslizantes:** `[Meu Time] -> [Time Azul] -> [Time Vermelho] -> [Time Verde]`.

---

## 🏟️ 6. MODO ESPECIAL: DIA DO RACHA (`MATCH_DAY`)

Nas 6 horas antecedentes ao apito inicial, a interface assume um "Modo de Prontidão" imersivo para preparar a logística física do jogo:

* **Hero de Impacto:** `🏟️ HOJE É DIA DE FUT.MANAGER!`
* **Widget Logístico Integrado:**
  * Mapa tático da Arena com botão direto para traçar rota no **Google Maps** ou **Waze**.
  * Temperatura em tempo real e previsão de chuva para o horário do racha.
* **Checklist Logístico do Jogador:**
  * Botão **"Tô Chegando!"** (Envia sinalização de posicionamento para o elenco).
  * Botão **"Estou Atrasado"** (Informa estimativa de minutos de atraso, preservando integridade de pontualidade).
  * Botão **"Imprevisto / Cancelamento"** (Notifica imediatamente o administrador e chama o primeiro reserva da fila em tempo recorde).

---

## ⏱️ 7. FLUXO POS-JOGO INTEGRADO

A Home guia o atleta em uma jornada natural para fechamento do ciclo esportivo semanal:

```
[FIM DO JOGO] ──► 1. AVALIAR JOGADORES ──► 2. VER RESULTADO ──► 3. VER ESTATÍSTICAS ──► 4. MUSEU (MEMÓRIAS)
```

1. **Fase 1: Avaliações (Foco Total)**
   * A Home exibe um modal ou card proeminente listando os atletas que estiveram em campo para atribuição de notas de 1 a 10 e destaques de Atitude.
2. **Fase 2: Consolidação**
   * Assim que o atleta submete suas notas, o fluxo desbloqueia e o redireciona automaticamente para visualizar os resultados da rodada e as mudanças nas tabelas de artilharia e ranking geral de OVR.

---

## ⚙️ 8. EXPERIÊNCIA DO ADMINISTRADOR (MODO INVISÍVEL)

O administrador utiliza a mesmíssima estrutura do Home Composer. No entanto, o sistema injeta controles discretos para garantir governança operacional sem poluir a atmosfera esportiva:

1. **Indicador "MODO DIRETORIA":**
   * Um badge extremamente sóbrio e sutil no topo superior direito (ao lado do avatar), informando que os controles de privilégio estão ativos.
2. **FAB de Contexto Rápido:**
   * Botão flutuante minimalista (ícone de engrenagem) que, ao ser expandido, revela as ações rápidas necessárias para o estado atual da rodada:
     * *Em convocação:* `Liberar vagas extras`, `Chamar reservas manualmente`.
     * *Em fechamento:* `Iniciar sorteio por Monte Carlo`, `Publicar escalações`.
     * *Pós-jogo:* `Concluir rodada`, `Lançar súmula oficial`.

---

## 🔄 9. MOTOR DE TRANSIÇÃO E ANIMAÇÕES

Todas as reestruturações de tela orquestradas pelo `HomeComposer` são executadas sem recarregar a página, amparadas por animações fluidas baseadas em curvas de movimento naturais (`motion/react`):

* **Transições de Módulos (Reorganização de Cards):**
  * Tipo de Movimento: **Staggered Layout Transitions** (os cards se organizam suavemente em cascata).
  * Duração: **300ms** (Limiar máximo para percepção instantânea).
  * Curva: `ease-out` ou `bezier(0.16, 1, 0.3, 1)`.
* **Micro-animações de CTAs:**
  * Botões de confirmação executam pulso leve de escala (1.02x) em estados pendentes para chamar a atenção de forma ergonômica.

---

## 🔗 Relacionamentos

- **Composer** (composer.md) → **Dynamic Engine** (dynamic-engine.md) ; define o contexto que alimenta o inventário de componentes.
- **Dynamic Engine** (dynamic-engine.md) → **Home Dynamic** (home-dynamic.md) ; detalha o rendering por estado.
- **Home Dynamic** (home-dynamic.md) → **Visual System** (visual-system.md) ; herda as diretrizes de cor, tipografia e espaçamento.

---

*Documentação consolidada a partir do legado (/docs/home_composer_architecture.md) e /docs/home_dynamic_architecture.md.*