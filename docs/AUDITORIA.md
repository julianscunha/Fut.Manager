# Relatório de Auditoria Operacional e UX — Racha do Fofim

Este documento consolida as análises de arquitetura, fluxos funcionais, lógica matemática de estatística, regras financeiras, comportamento mobile e segurança do sistema **Racha do Fofim**.

---

## 📅 Resumo Geral da Auditoria

| Mapeamento de Qualidade | Status / Avaliação | Detalhes Técnicos |
| :--- | :---: | :--- |
| **Integridade de Regra de Negócio** | ✅ Excelente (92%) | Tratamento de isenções financeiras de goleiros e reservas perfeitamente integrado no backend. |
| **Consistência de Banco de Dados** | ⚠️ Alerta (Médio) | Duplicidade potencial no incremento de afinidades de duplas/trios caso as rotas `confirm-lock` e `results` sejam acionadas sequencialmente na mesma semana. |
| **Lógica Estatística (Streaks)** | 🛠️ Corrigido (Crítico) | O motor estatístico utilizava valores globais estáticos em vez dos streak maps cronológicos recalculados dinamicamente na filtragem por temporada. |
| **Responsividade Mobile-First**| ⚠️ Corrigido (era superestimado) | A alegação original de "95% excelente" não se sustentou em auditoria independente (ver §16) — corrigidos: affordance de scroll ausente nas sub-abas, alvo de toque inconsistente (agora padronizado globalmente via CSS), ~400 linhas de código morto/órfão removidas. |
| **Persistência de Dados** | ✅ Migrado | De arquivo JSON local (`data/database.json`) para Postgres via Supabase, com Storage para uploads. Ver §14. |
| **Autenticação** | 🛠️ Corrigido (Crítico) | Header `x-user-id` forjável substituído por JWT assinado + bcrypt. Ver §15. |

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

> **Nota (atualização posterior):** a avaliação acima (item 13) foi a auto-avaliação original do sistema. Uma auditoria independente subsequente (§16) verificou os componentes linha a linha e encontrou divergências reais em relação a essa nota — ver §16 para os achados corrigidos.

### 14. Migração de Hospedagem: Supabase (Postgres + Storage) + Render
*   **Motivação:** o sistema rodava inteiramente sobre um arquivo `data/database.json` local (sem banco de dados real) e uploads gravados em disco local, inviabilizando qualquer hospedagem em nuvem persistente.
*   **O que mudou:**
    *   **Persistência:** `server/db.ts` reescrito para usar Postgres via Supabase. `readDb()`/`writeDb()` fazem leitura/escrita em lote de 31 tabelas (schema espelhando `src/types.ts` campo a campo), com rastreamento de "sujeira" (snapshot) para só regravar tabelas que realmente mudaram a cada requisição.
    *   **Uploads:** fotos de jogador e mídia do mural migradas para Supabase Storage (bucket `Uploads`, público), com validação real de tipo por magic bytes (`file-type`) e tamanho real do buffer — antes a "integração com S3" era inteiramente simulada (URL fake, sem upload de verdade).
    *   **Schema sem foreign keys:** decisão deliberada — o sistema original (JSON) nunca teve integridade referencial no banco, sempre gerenciada em código; manter esse modelo permite escrita independente por tabela sem se preocupar com ordem de dependências.
    *   **Hospedagem:** Render (Web Service único via Docker), servindo frontend + API no mesmo processo — decisão de custo-benefício frente a separar frontend (Amplify) e backend (App Runner), que sairia mais caro para o volume de uso deste grupo.
*   **Guia completo:** ver [`DEPLOY.md`](DEPLOY.md) (passo a passo de setup) e [`DEPLOY-CHECKLIST.md`](DEPLOY-CHECKLIST.md) (checklist de verificação).

### 15. Hardening de Segurança (achados críticos corrigidos na migração)
Auditoria de segurança encontrou e corrigiu, antes de expor o sistema publicamente:

1.  **Impersonation total (Crítico):** `getAuthenticatedUser` confiava cegamente no header `x-user-id` enviado pelo cliente — qualquer requisição podia forjar esse header e agir como qualquer usuário, inclusive admin. **Corrigido:** autenticação por JWT assinado (`server/auth.ts`), verificado via header `Authorization: Bearer <token>`. Testado explicitamente: forjar o header antigo agora retorna 401.
2.  **Senha em texto puro (Crítico):** senhas armazenadas sem hash. **Corrigido:** hash bcrypt (10 rounds) via `bcryptjs`, com seed inicial gerado por `pgcrypto` no próprio SQL.
3.  **Reset de senha sem validar token (Crítico):** `/api/auth/reset-password` trocava a senha de qualquer usuário sem checar o token gerado em `/forgot-password`. **Corrigido:** token com expiração de 15 minutos, validado e descartado após uso único.
4.  **Vazamento de dados de usuários (Crítico):** `GET /api/users` retornava a lista completa (incluindo e-mails) sem autenticação nenhuma. **Corrigido:** exige role admin/auxiliar.
5.  **Confiança em `role` vindo do cliente (Alto):** ~7 rotas (mural, eventos, financeiro) liam `reqUserRole`/`req.query.userRole` do body/query do cliente para decidir permissões — um usuário comum podia se passar por admin manipulando o payload. **Corrigido:** role sempre derivado do usuário autenticado no servidor.
6.  **Upload sem validação real (Alto):** validava só extensão/mimetype declarado pelo cliente. **Corrigido:** validação por magic bytes + tamanho real do buffer.
7.  **Sem rate limiting (Crítico):** zero proteção contra força bruta em login/reset. **Corrigido:** `express-rate-limit` (5 tentativas / 15 min) nas rotas de auth.
8.  **Sem CORS/Helmet:** **Corrigido:** `helmet()` + `cors()` com allowlist via `ALLOWED_ORIGINS`.

### 16. Auditoria de Frontend, Mobile e Limpeza de Legado
Auditoria independente (screenshots reais em viewport mobile via Playwright/Chromium, com emulação de toque `pointer: coarse`) encontrou e corrigiu:

*   **Affordance de scroll ausente (Alto):** sub-abas de Tesouraria, Administração e Rodadas usam um componente compartilhado (`ResponsiveTabsContainer`) que já era rolável horizontalmente, mas cortava o texto abruptamente na borda sem nenhuma pista visual — parecia quebrado, mas era só falta de indicação. **Corrigido:** fade via `mask-image` nas bordas (aparece/some dinamicamente conforme a posição de scroll), aplicado de uma vez em todas as telas que usam o componente.
*   **Alvo de toque inconsistente (Alto):** ~620 botões espalhados por 17 componentes, com menos de 5% usando `min-h-[44px]` explicitamente. Refatorar botão a botão foi descartado por risco/esforço desproporcional; **corrigido via CSS global** (`@media (pointer: coarse) { button:not(.btn-compact) { min-height: 44px; } }`) — aplica altura mínima de toque em todo botão do app em dispositivos reais de toque, sem afetar a densidade do desktop (mouse) e sem exigir tocar em nenhum componente individual. Validado visualmente em 5 telas sem regressão de layout.
*   **Painel de teste morto em produção (`TechnicalRanking.tsx`):** um bloco inteiro de ~310 linhas ("Homologação de Badges" — seletor de cenários, matriz de teste, relatório de auditoria mock) estava gated atrás de `{false && (...)}` — nunca renderizava, mas era compilado e mantido junto ao código real. Removido por completo.
*   **Código órfão generalizado:** varredura com `tsc --noUnusedLocals` encontrou 245 declarações não usadas (imports, variáveis, funções) em 22 arquivos. Destaque: `DashboardStatus.tsx` (o Home real do app) tinha **29 funções inteiras órfãs** (`handleQuickApproveUser`, `handleBulkTogglePresence`, `handleMassClearConfirmations` etc.) — funcionalidades completas e implementadas, mas sem nenhum botão as chamando mais, provavelmente substituídas por `UserApprovalList.tsx` e outros componentes dedicados sem a limpeza correspondente. Removidas com segurança estrutural via `ts-morph` (não regex), com validação de compilação a cada etapa.
*   **Feature morta em `FinanceManager.tsx`:** um indicador de "limite de mensalistas quase atingido" (cor/texto calculados) nunca era exibido em nenhum lugar da UI — o cálculo existia, mas o resultado nunca chegava a ser renderizado. Removido.
*   **Texto residual "AWS S3"/legado:** referências a "upload direto para AWS S3" e um rótulo "AWS S3: PRONTO_OK" sobreviveram à migração de código mas não à limpeza de texto — corrigidos para refletir o Supabase Storage real.
*   **2 bugs reais de regressão encontrados via teste end-to-end do avatar com IA** (ver §17): condição de corrida no disparo do processamento em background, e violação de constraint única de e-mail — ambos corrigidos e testados.

### 17. Validação de Geração de Avatar com IA (Gemini direto e via OpenRouter)
Testado de ponta a ponta pela interface real (não só leitura de código), com chaves reais fornecidas para o teste:

*   **Bug encontrado e corrigido — condição de corrida:** o disparo do processamento de avatar em background (`setImmediate(() => processarAvatarGamerBackground(...))`) ocorria **antes** do `await writeDb(db)` que persiste o novo jogador. No sistema antigo (síncrono) isso nunca foi um problema, porque a escrita bloqueava o processo até terminar antes de qualquer callback assíncrono rodar; a migração para I/O assíncrono (Supabase) introduziu a corrida, fazendo o processamento de avatar falhar com "Atleta não encontrado" em toda criação de jogador com foto. **Corrigido:** o disparo agora ocorre só depois do `writeDb` completar.
*   **Bug encontrado e corrigido — constraint única de e-mail:** jogadores sem e-mail eram salvos com `email: ''` (string vazia). Postgres trata múltiplas strings vazias como valores duplicados sob uma constraint `UNIQUE` (diferente de `NULL`, que pode se repetir livremente) — o segundo jogador cadastrado sem e-mail sempre falhava com `duplicate key value violates unique constraint`. **Corrigido:** e-mail vazio é normalizado para ausente (vira `NULL` no banco) antes de gravar.
*   **Gemini direto — integração confirmada funcional, mas bloqueada por cota:** após as correções acima, a chamada real à API do Gemini retornou `429 RESOURCE_EXHAUSTED` (cota zero no tier gratuito para o modelo de geração de imagem no projeto Google Cloud da chave testada). Não é um bug de código — autenticação e formato da requisição corretos (erro de auth retornaria 401/403, não 429).
*   **Provedor OpenRouter adicionado** (`server/avatarProvider.ts` → `OpenRouterAvatarProvider`, via `POST /api/v1/images`, com `AvatarProviderFactory` priorizando `OPENROUTER_API_KEY` sobre `GEMINI_API_KEY`): testado com chave real.
    *   Modelo `google/gemini-2.5-flash-image` via OpenRouter reproduziu o **mesmo** erro de cota zero — a OpenRouter roteia esse modelo pela integração gratuita "Google AI Studio" do próprio Google, sujeita à mesma restrição.
    *   Modelo `openai/gpt-image-1` via OpenRouter **gerou com sucesso** um retrato realista completo (uniforme do Flamengo com patrocinador e escudo corretos, fundo de estádio) — confirmando toda a integração (requisição, autenticação, parsing de resposta, gravação no Storage) funcional de ponta a ponta. Definido como modelo padrão em `.env.example`.
*   **Fallback de erro validado:** quando a geração falha (por qualquer motivo), o sistema corretamente marca `avatarStatus: 'ERRO'` e limpa `avatarCard`/`avatarEsportivo`, sem deixar o registro em estado inconsistente ou travado em "processando".

### 18. Validação Final de Segurança Pré-Produção (antes de exposição pública)

Segunda rodada de auditoria, mais ampla que a de migração (§15), feita rota a rota em todo `server.ts` (~90 endpoints), já com o sistema no modelo final (Supabase + JWT):

*   **Ausência de autenticação em ~80 rotas de negócio (Crítico):** apesar da migração de `x-user-id` para JWT (§15), as rotas em si (`/api/players`, `/api/matches`, `/api/finances`, `/api/mural`, `/api/draws`, etc.) não tinham nenhuma chamada a `getAuthenticatedUser` — dependiam apenas de checagens pontuais e inconsistentes espalhadas pelo código. Qualquer requisição sem token conseguia ler/gravar dados de negócio diretamente. **Corrigido:** middleware global `app.use('/api', ...)` adicionado logo após o parsing do body, antes de todas as rotas, exigindo `getAuthenticatedUser(req)` bem-sucedido para qualquer rota não listada em um allowlist explícito de rotas públicas (`PUBLIC_API_ROUTES`: login, registro, forgot/reset-password, mural público, próximo jogo público). Verificado com `curl` (rotas públicas sem token → 200; rotas protegidas sem token → 401; qualquer rota com token válido → 200) e com passagem completa de ponta a ponta via Playwright (login real + navegação por todas as 8 abas principais, zero requisições `/api/*` com erro e zero erros de console).
    *   **Detalhe de implementação:** como o middleware é montado com `app.use('/api', middleware)`, o Express remove o prefixo `/api` de `req.path` dentro dele — os regexes do allowlist não incluem esse prefixo (ex. `/^\/auth\/login$/`, não `/^\/api\/auth\/login$/`). Erro cometido e corrigido na própria implementação: uma primeira versão incluía `/api` nos regexes, o que bloqueava indevidamente também as rotas que deveriam ser públicas.
*   **Endpoints de upload sem checagem de autenticação própria (Alto):** `/api/upload-s3` e `/api/mural/upload` dependiam só da proteção do gate global (acima). Como camada adicional de defesa em profundidade, cada um passou a fazer sua própria checagem explícita de `getAuthenticatedUser(req)` logo no início do handler, independente do middleware global.
*   **CVE de DoS na biblioteca `file-type` (Moderado):** versões 13.0.0–21.3.0 possuem um loop infinito conhecido ao processar entrada ASF malformada. **Corrigido:** atualizado de `18.7.0` para `22.0.1`. Como a partir da v19 o pacote é ESM puro, a compatibilidade foi validada explicitamente tanto em desenvolvimento (`tsx`) quanto no bundle de produção real (`node dist/server.cjs`, Node v24, usando o suporte nativo a `require(esm)`), com upload de imagem real testado em ambos os modos — não apenas assumida.

---

## 🛠️ Correções Implementadas

1.  **Bug de Estatísticas de Streaks (statsEngine.ts):**
    *   *Antes:* Utilizava `p.currentStreak` (global, sem sensibilidade da temporada filtrada).
    *   *Depois:* Utiliza os mapas computados dinamicamente com base nas datas das partidas da temporada: `currentStreakMap[p.id]` e `maxStreakMap[p.id]`.
2.  **Painel de Aprovações Unificado (UserApprovalList.tsx):**
    *   Criação de centro completo de administração de acessos com listagem geral, análise individualizada do perfil inicial na aprovação, verificação visual clara do vínculo do atleta com base em e-mail e aba de auditorias em tempo real.
3.  **Migração de hospedagem para Supabase + Render** (ver §14), com hardening de segurança completo (ver §15).
4.  **Auditoria de frontend/mobile e limpeza de legado** (ver §16): affordance de scroll, alvo de toque global, ~620 linhas de código morto/órfão removidas.
5.  **Dois bugs de regressão corrigidos via validação end-to-end do avatar com IA** (ver §17): condição de corrida no processamento em background e violação de constraint única de e-mail.
6.  **Validação final de segurança pré-produção** (ver §18): gate global de autenticação cobrindo ~80 rotas de negócio antes desprotegidas, checagem própria de autenticação nos endpoints de upload, e correção de CVE de DoS na biblioteca `file-type`.
