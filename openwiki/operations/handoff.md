---
type: Project Handoff Notes
title: Automation.Lab Handoff
description: Executive summary of system status, completed features, and resolved bugs for Fut.Manager, serving as a handoff artifact for future maintainers.
tags: [handoff, operations, maintenance]
---

# Automation.Lab Handoff

## Estado Atual

Resumo executivo do estado atual do sistema Fut.Manager:

- Sistema de Sorteio de Equipes (Draft e Algoritmo Equilibrado) [OK]
- Limite de Re-sorteios de Partidas por Governança [OK]
- Validação de Presença e Sincronização de Status [OK]
- Correção de Bloqueio Prematuro de Re-sorteios (0/2 e 1/2 habilitados de verdade) [OK]
- Painel Operacional de Ações [OK]
- Auditoria Visual e Funcional do Mural e de Comunicação [OK]

---

## Funcionalidades Concluídas

Lista cronológica de entregas técnicas e correções de governança.

### 2026-07-31
**Limpeza de Storage, Destaque da Semana com Carrossel, Correção de Avatares, Templates de E-mail e Documentação**

- Removidas tabelas mortas do banco: `snapshots`, `mural_highlights`, `mural_files`.
- Corrigido bug que deixava foto antiga órfã no Supabase Storage ao trocar `photoOriginal` do jogador (`avatarOriginal` não era atualizado).
- Deletados arquivos órfãos do bucket `Uploads` (`1785262679083-whatsapp-image-2026-07-28-at-15.17.37.webp` e pasta `avatars` vazia).
- `DELETE /api/mural/posts/:id` agora apaga `mediaUrl`/`thumbnailUrl`/`mediumUrl` do Supabase Storage.
- Adicionado carrossel automático no bloco "Destaque da Semana" do dashboard (6s por foto, com controles manuais).
- Corrigido widget Cloudflare Turnstile que não aparecia em mobile (`justify-center` + falta de `overflow-y-auto`).
- Corrigido bug de precedência de operadores em JSX que exibia URL string ao invés da imagem no destaque do mural.
- Corrigidas referências quebradas de `imageUrl`/`content`/`text` para `mediaUrl`/`description` em `DashboardStatus.tsx` e `CalendarManager.tsx`.
- Removido endpoint `/api/admin/cleanup-storage` (não era necessário; limpeza foi feita manualmente e o fluxo de upload/remoção agora limpa automaticamente).
- Corrigido tipo `NotificationCategory` ausente em `src/types.ts`.
- Refeitos templates de e-mail (`server/email-templates/`) com layout moderno similar ao modelo Safium, tema verde do sistema, textos mais naturais e footer contendo link do app + suporte.
- Adicionado e-mail de boas-vindas enviado automaticamente após aprovação de cadastro.
- Adicionado endpoint `POST /api/admin/reengage-inactive` para reengajar jogadores com status `indisponivel` há mais de 6 meses, com e-mail humano e sem tom robótico.

Arquivos alterados: `server.ts`, `server/email-templates/base.ts`, `server/email-templates/welcome.ts`, `server/email-templates/reengage-inactive.ts`, `server/email-templates/index.ts`, `src/components/DashboardStatus.tsx`, `src/components/CalendarManager.tsx`, `src/components/TechnicalRanking.tsx`, `src/components/PlayerCard.tsx`, `src/components/PlayerHero.tsx`, `src/components/PlayerEvaluationModal.tsx`, `src/components/PlayerDomainCards.tsx`, `src/components/EventManager.tsx`, `src/components/DrawManager.tsx`, `src/components/FinanceManager.tsx`, `src/types.ts`, `src/utils/playerAvatar.ts`, `.gitignore`, `README.md`, `openwiki/operations/handoff.md`.

### 2026-07-04
**Remoção do Placar Consolidado, Ajustes de Ações de Fim de Jogo, Responsividade e Paginação do Museu, Correções de Renderização e Limpeza de Produção**

- Removido bloco de "Placar Consolidado" na tela de pós-jogo finalizado (`PARTIDA_ENCERRADA`) em `DashboardStatus.tsx`.
- Ocultado botão "Compartilhar Convocações" nas ações rápidas administrativas quando status da partida é `encerrada`.
- Menu de abas do Museu do Clube atualizado com `flex-wrap` responsivo para mobile.
- Paginação dinâmica no feed cronológico de memórias (limite de 10 itens/página).
- Corrigido erro `Objects are not valid as a React child` no `UserApprovalList.tsx`.
- Removido botão "Gerar 10 Atletas" e purga do banco fictício (`database.json`), disponibilizando ambiente limpo com `admin@racha.com`.

Arquivos alterados: `DashboardStatus.tsx`, `MuralManager.tsx`, `UserApprovalList.tsx`, `App.tsx`, `server/db.ts`.

### 2026-06-24
**Mural V2 — Museu do Clube**

Transformação do "Mural e Comunicação" em "Museu do Clube" com 5 abas:
1. 📸 Memórias — galeria agrupada cronologicamente com filtros por partida.
2. 🏆 Momentos Épicos — consagração visual de fatos lendários com tags estilizadas.
3. 📜 História do Clube — linha do tempo vertical interativa de todas as rodadas.
4. 📢 Comunicação — central unificada de avisos e comunicados oficiais.
5. 🗄️ Arquivo — histórico de publicações arquivadas ou excluídas logicamente.

Arquivos alterados: `MuralManager.tsx`.

### 2026-06-23 (Hotfix)
**Resiliência na Resolução de Notificações e Consultas por Email**

Corrigido erro fatal causado por `.toLowerCase()`/`.split()` em propriedades nulas de jogadores sem email. Implementadas travas de segurança em `syncDynamicNotifications`, `/api/notifications`, `/api/notifications/mark-all-read`, `/api/finances/toggle`, e GET de cobranças.

### 2026-06-23
**Auditoria Visual e Funcional do Mural**

Mapeamento detalhado de todos os componentes, estados, fluxos de dados e controles de permissão do Mural e Central de Comunicação. Nenhuma lógica operacional foi modificada.

### 2026-06-22
**Correção de Bloqueio Prematuro de Re-sorteios**

O limite de 2 re-sorteios agora é verificado tanto no cliente quanto no servidor. Bloqueio ocorre apenas quando `redrawCount >= 2`. Partidas canceladas ou encerradas também estão bloqueadas.

---

## Decisões Arquiteturais Validadas

- Limite de re-sorteio (máx 2) deve ser verificado no frontend e no backend.
- Status `sorteada` sozinho não bloqueia re-sorteios; apenas `redrawCount >= 2` trava definitivamente.
- Sorteios são irreversíveis quando partida está `cancelada` ou `encerrada`.

---

## Auditorias Encerradas

### Bloqueio Prematuro de Sorteio (2026-06-22)
- Causa raiz: frontend e backend usavam `match.status === 'sorteada'` como impedimento, anulando re-sorteios legítimos.
- Correção: lógica de bloqueio agora baseada em `redrawCount >= 2`.
- Status: **ENCERRADO**.

---

## Pendências Priorizadas

| Prioridade | Item |
|:---:|---|
| P0 | Monitorar feedback de usuários sobre eficácia de afinidades do motor de sorteio. |
| P1 | Feedback de auditoria do log de auditorias quando houver trocas manuais após bloqueio. |
| P2 | Indicador visual das trocas manuais efetuadas na partida pós-fechamento do sorteio. |

---

## Próximo Passo Obrigatório

Monitorar comportamento do motor de sorteio com novos perfis de atletas e coletar feedbacks.

---

## O Que NÃO Deve Ser Reauditado

- Motor de sorteio inteligente e cálculo de diferença técnica.
- Mecanismo de persistência das ligas locais e sincronização.
- Lógica de bloqueio cumulativo de 2 re-sorteios (`redrawCount >= 2`).

---

## Critérios para Próxima Sessão

1. Ler handoff.md.
2. Ler seção Pendências.
3. Ler Próximo Passo Obrigatório.
4. Continuar diretamente da pendência.
5. Não executar auditorias já encerradas.
6. Reauditar apenas mediante evidência de regressão.