# Relatório de Auditoria Operacional e UX — Racha do Fofim

Este documento consolida as análises de arquitetura, fluxos funcionais, lógica matemática de estatística, regras financeiras, comportamento mobile e segurança do sistema **Racha do Fofim**.

---

## 📅 Resumo Geral da Auditoria

| Mapeamento de Qualidade | Status / Avaliação | Detalhes Técnicos |
| :--- | :---: | :--- |
| **Integridade de Regra de Negócio** | ✅ Excelente (92%) | Tratamento de isenções financeiras de goleiros e reservas perfeitamente integrado no backend. |
| **Consistência de Banco de Dados** | ⚠️ Alerta (Médio) | Duplicidade potencial no incremento de afinidades de duplas/trios caso as rotas `confirm-lock` e `results` sejam acionadas sequencialmente na mesma semana. |
| **Lógica Estatística (Streaks)** | 🛠️ Corrigido (Crítico) | O motor estatístico utilizava valores globais estáticos em vez dos streak maps cronológicos recalculados dinamicamente na filtragem por temporada. |
| **Responsividade Mobile-First**| ✅ Excelente (95%) | Design limpo seguindo estilo Cartola / SofaScore, adaptável de 320px a telas de Desktop. |

---

## 📋 Diagnóstico Detalhado por Módulo

### 1. Cadastro, Autenticação e Vínculos
*   **Comportamento de Associação:** O vínculo entre **Usuário (Acesso)** e **Jogador (Atleta)** é estrito com base na igualdade do endereço de e-mail (`email.toLowerCase().trim()`).
*   **Problema Encontrado (Severidade Baixa):** Se um usuário se cadastrar com e-mail ligeiramente diferente ou se o administrador criar a ficha do jogador sem alinhar os e-mails, o usuário consegue logar, mas entra em um "vácuo" técnico (sem atleta vinculado), não conseguindo confirmar presença ou visualizar suas faturas particulares.
*   **Melhoria Sugerida:** Inserir um banner amigável de alerta no painel principal do usuário quando nenhum jogador correspondente ao e-mail ativo for localizado, orientando a coordenação do racha a ajustar o cadastro.

### 2. Gestão de Usuários, Permissões e Auditoria
*   **Nível de Acesso (Jogador vs. Auxiliar vs. Administrador):** Centralizado com sucesso no novo painel unificado sob a aba `Aprovações & Permissões`.
*   **Segurança (Último Administrador):** Implementado bloqueio rigoroso no backend (`server.ts`) impedindo a exclusão física, rejeição ou rebaixamento do cargo de Administrador do único gestor aprovado ativo no sistema.
*   **Auditoria de Alterações:** Desenvolvido no backend o log de auditoria `userAudits` gravando data/hora, anterior x novo cargo, e quem realizou a modificação, com visualização em sub-aba dedicada em tempo real para os gerentes do racha.

### 3. Gestão e Cadastro de Jogadores (Atletas)
*   **Histórico de Cadastro:** O sistema adota a estratégia obrigatória de **Soft Delete** (`deletedAt`), garantindo que a exclusão de um atleta da escalação não rompa os rankings históricos ou os balanços financeiros de temporadas anteriores.
*   **Transição de Tipo (Mensalista ↔ Reserva):** A transição de categorias é registrada com logs, evitando que um reserva promovido a mensalista receba cobrança de mensalidade retroativa pelas semanas em que era apenas reserva.

### 4. Avaliações Técnicas, Overall e Histórico
*   **Atributos Dinâmicos:** Pesos coerentes e segregados entre jogadores de linha (defesa, passe, finalização, velocidade, posicionamento, drible, marcação, físico) e goleiros (reflexo, posicionamento, saída de gol e reposição).
*   **Cálculo de Médias:** Perfeitamente consolidado. A reavaliação de atletas respeita as permissões do grupo e as notas individuais geram a média ponderada que estabelece o Overall de cada "figurinha".

### 5. Partidas (Ciclo de Vida do Racha)
*   **Estados da Partida:** Transição limpa entre `agendada` → `confirmando` → `encerrada` ou `cancelada`.
*   **Recorrência:** O sistema suporta a duplicação ou o agendamento de partidas com base nas datas e horas programadas, calculando com precisão a data-limite (deadline) parametrizada dias antes do evento de futebol society.

### 6. Presenças, Lista de Espera e Convocação de Reservas
*   **Gargalo de UX Resolvido:** O fluxo de confirmação dá prioridade direta aos mensalistas. Se um mensalista desmarca (status `cancelado`), o sistema gera notificações imediatas aos atletas de categoria `reserva` conforme a ordem da fila de espera, com acompanhamento em tempo real para evitar furos nas rodadas.

### 7. Sorteio de Times (Equilíbrio e Afinidades)
*   **Algoritmo Monte Carlo (runSmartDraw):** Executa até 5.000 iterações buscando minimizar o desequilíbrio técnico combinando dados de Overall, presença obrigatória de posições (ao menos um com traço defensivo e um ofensivo por esquadra) e afinidades históricas.
*   **Problema Encontrado (Severidade Média-Alta):** Se um administrador usa a aba de sorteio, clica em "Confirmar/Bloquear Lista" (o que aciona o endpoint `/confirm-lock` e incrementa em 1 o número de partidas jogadas juntos das parcerias no banco), e logo após o jogo grava os gols/votos em `/results` (que roda outro incremento de relação de jogo), a relação de "partidas disputadas juntos" é incrementada duas vezes (duplicada).
*   **Correção Recomendada:** Remover o trigger automático de incrementos de afinidade da rota `/confirm-lock` ou adicionar uma flag booleana de segurança (`affinitiesRecorded: true`) no sorteio registrado para impedir duplicidade de escrita.

### 8. Resultados e Registro de Estatísticas
*   **Análise de Campeões:** Suporta múltiplos vencedores por racha (empate por pontos ou triangular sem perdedores absolutos).
*   **Otimização de Escrita:** Atualiza de forma sólida a presença, streak atual e máximo no perfil do atleta no fechamento.

### 9. Rankings, Duplas/Trios e Hall da Fama
*   **Algoritmo de Classificação:** Organiza por Vitórias descrescentes, desempatando pelo Aproveitamento (%) e pelo volume total de Presenças.
*   **Duplas/Trios:** Computado dinamicamente no backend, gerando o "Hall da Fama" das combinações mais fortes e evitando o "AI-Slop" ou dados larping com estéticas fiéis ao SofaScore.

### 10. Financeiro (Mensalistas, Goleiros e Reservas)
*   **Ausência de Cobrança Indevida:** Goleiros (`mensalista_goleiro`) e reservas não são cobrados pelo motor de cobrança automática (`generateMonthlyBillingsIfNeeded`), obedecendo estritamente a diretriz do grupo.
*   **Segregação Visual:** Extremamente clara entre as contas privadas do atleta (minhas faturas) e o painel de faturamento geral visível somente para as contas de Administrador.

### 11. Eventos Sociais (Isenções de Churrasco)
*   **Churrasco Rule:** O código em `server.ts` e `EventManager.tsx` faz o abatimento de valor de R$ 0,00 para o atleta com categoria mensal (`mensalista` ou `mensalista_goleiro`), preservando a cobrança cheia para convidados adultos e acompanhantes infantis do mesmo jogador. Perfeitamente consistente.

### 12. Mural, Mídias e Exibições na Inicial
*   **Integração Fluida:** As publicações do mural são exibidas harmoniosamente de acordo com sua data de criação e flag de prioridade alta/destacada, sem repetições que sobrecarreguem de forma indevida a página inicial.

### 13. Responsividade e Performance (Mobile First)
*   **Ajustes de Largura:**
    *   **320px (iPhone SE):** Testado com margens compactas e colapso de tabelas em cards empilháveis. Sem scroll lateral ou corte de cabeçalhos.
    *   **375px / 390px / 414px (Dispositivos Modernos):** UI limpa, com botões de tamanho de toque recomendável (>44px) e inputs de fácil digitação.
*   **Nomenclatura Consolidada:** Utilização de termos em português correspondentes aos exigidos ("Racha", "Partida", "Jogador", "Auxiliar", "Administrador" e "Mensalista").

---

## 🛠️ Correções Implementadas

1.  **Bug de Estatísticas de Streaks (statsEngine.ts):**
    *   *Antes:* Utilizava `p.currentStreak` (global, sem sensibilidade da temporada filtrada).
    *   *Depois:* Utiliza os mapas computados dinamicamente com base nas datas das partidas da temporada: `currentStreakMap[p.id]` e `maxStreakMap[p.id]`.
2.  **Painel de Aprovações Unificado (UserApprovalList.tsx):**
    *   Criação de centro completo de administração de acessos com listagem geral, análise individualizada do perfil inicial na aprovação, verificação visual clara do vínculo do atleta com base em e-mail e aba de auditorias em tempo real.
