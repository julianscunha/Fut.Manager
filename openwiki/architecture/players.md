---
type: Player Logic
---
title: Lógica de Posição de Jogadores e Atribuição Tática

description: Documenta como as posições dos jogadores (primaryPosition vs secondaryPositions) são gerenciadas e atribuídas para composição de equipe, incluindo restrições táticas e lógica de validação.

tags: [player-logic, positions, tactics, assignment]

---

# Lógica de Posição de Jogadores e Atribuição Tática

Este documento detalha como as posições dos jogadores são gerenciadas no Fut.Manager, focando na distinção entre `primaryPosition` e `secondaryPositions`, a lógica tática de atribuição de posições e as validações que garantem escalações corretas.

## Estrutura de Posições de Jogadores

### Tipos de Posições

O sistema utiliza cinco posições base:

- **goleiro** (goalkeeper)
- **zagueiro** (defender)
- **meio_campo** (midfielder)
- **volante** (defensive midfielder)
- **atacante** (forward)

Cada jogador possui:

- **`primaryPosition`**: Posição principal preferida e mais adequada para o jogador
- **`secondaryPositions`**: Array opcional de posições secundárias que o jogador pode desempenhar se necessário

## Algoritmo de Atribuição Tática

### Backtracking de Atribuição de Posições

O componente `DashboardStatus.tsx` implementa um algoritmo de backtracking para atribuir posições aos jogadores de forma otimizada, evitando erros de escalação (ex: zagueiro como GK) e maximizando a adequação.

#### Regras de Validação Principais

1. **Regra de Exclusão de Goleiro**:
   - Jogadores cuja `primaryPosition !== 'goleiro'` e que **não possuem** `'goleiro'` em `secondaryPositions` são automaticamente excluídos da posição de goleiro.
   - Goleiros profissionais podem ser escalados apenas como goleiros, mantendo a integridade tática.

2. **Sistema de Pontuação**:
   - `primaryPosition`: +10 pontos (máxima adequação)
   - `secondaryPosition`: +6 pontos (adequação moderada)
   - `goleiro` escalado em posição não-goleiro: -50 pontos (penalidade pesada)
   - Posição não-primária: +1 ponto (adequação básica)
   - Bônus de posições únicas: +5 pontos por cada posição diferente atribuída

3. **Balanceamento de Equipe**:
   - O algoritmo busca uma distribuição equilibrada de posições na escalação final
   - Prioriza escalar com base na ordem de tentativa no backtracking

### Fluxo de Atribuição

```
Entradas:
  - Lista de jogadores com primaryPosition e secondaryPositions
  - Restrições de contexto (ex: proibição de goleiro)

Processo:
  1. Gerar todas as atribuições possíveis respeitando as restrições
  2. Calcular pontuação para cada atribuição
  3. Selecionar a atribuição com maior pontuação
  4. Gerar mapeamento final: playerId → {position, isAdapted}

Saídas:
  - Mapeamento de posições atribuídas para cada jogador
  - Flag isAdapted indicando se a posição é diferente da positionPrimary
```

## Exemplo de Lógica de Posição

```typescript
function computeTacticalAssignments(playersList: Player[]): Record<string, { position: string; isAdapted: boolean }> {
  // Remove 'goleiro' de candidatePositions para não-goleiros sem goleiro secundário
  let candidatePositions = [...positions];
  if (player.primaryPosition !== 'goleiro' && 
      (!player.secondaryPositions || !player.secondaryPositions.includes('goleiro'))) {
    candidatePositions = candidatePositions.filter(pos => pos !== 'goleiro');
  }
  
  // ... resto do algoritmo de backtracking
}
```

## Tratamento Especial de Goleiros

O sistema implementa tratamento rigoroso para goleiros:

1. **Exclusão de Proibição**: Apenas goleiros (primary ou secondary) podem ser escalados como goleiros
2. **Penalidade de Qualidade**: Penalidade de -50 pontos aplica-se a qualquer escalação incorreta de goleiro
3. **Obrigatoriedade Tática**: Equipes devem escalar exatamente um goleiro quando disponível

## Integração com Funcionalidades do Sistema

### Regras de Escalação e Reservas

O algoritmo de atribuição de posições integra-se com o sistema de escalação:

- **Convocação de Presença**: Jogadores escalados em posições válidas podem ser confirmados para o time
- **Sistema de Reservas**: Jogadores não escalados podem ser promovidos automaticamente a reservas após o prazo de confirmação
- **Alertas de Posição**: O sistema monitora potenciais problemas de posição (ex: falta de goleiro)

### Visualização do Status do Dashboard

`DashboardStatus.tsx` utiliza `computeTacticalAssignments` para:

- Mostrar posições corretas dos jogadores na interface
- Indicar quando um jogador está escalado em posição secundária (`isAdapted: true`)
- Exibir alertas quando o sistema detecta problemas potenciais (ex: falta de goleiro)
- Fornecer sugestões de reservas com base na composição atual de posições

## Regressão e Validação

### Erros Comuns Evitados

1. **Atribuição Incorreta de Goleiro**:
   - Problema: Zagueiros escalados como goleiros
   - Solução: Regra de exclusão e penalidade de pontuação
   - Impacto: Equipes sempre possuem goleiro válido escalado

2. **Excesso de Especialistas**:
   - Problema: Muito poucos jogadores escalados em posições secundárias
   - Solução: Algoritmo de backtracking busca equilíbrio
   - Impacto: Equipes têm melhor flexibilidade tática

3. **Não Uso de Reservas**: 
   - Problema: Jogadores qualificados não estão na lista de reservas
   - Solução: Sistema de ranking de reservas e promoção automática
   - Impacto: Equipes têm sempre banco qualificado disponível

## Componentes Relacionados

- **`PlayerEvaluationModal`**: Avalia desempenhos que podem influenciar ajustes de posição futuros
- **`HomeComposer`**: Utiliza estado de posição para composição dinâmica de interface
- **`drawEngine.ts`**: Utiliza informações de posição durante sorteio de times

## Considerações Futuras

1. **Ajustes de Aprendizado de Máquina**: Futuramente o sistema pode adaptar pontuação com base em desempenhos históricos
2. **Análise de Opponentes**: Algoritmo pode considerar forças/fracassos do oponente para ajustar formações
3. **Mudanças Táticas Dinâmicas**: Coaching strips podem modificar regras de atribuição tática em tempo real

## Contexto Visual

O algoritmo assegura que a interface do usuário (DashboardStatus) exibe posições corretas e evita escalações ilegais:

```
Players    →   computeTacticalAssignments()   →   PositionMap
(jogador1)     (backtracking tático)              (posições validadas)
(jogador2)     (regras de validação)              (ex: goleiro escalado)
```

Este sistema garante que as equipes mantenham integridade tática enquanto maximizam o potencial de cada jogador.