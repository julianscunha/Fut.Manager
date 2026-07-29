# Graph Report - Fut.Manager  (2026-07-29)

## Corpus Check
- 99 files · ~163,062 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 679 nodes · 1037 edges · 70 communities (36 shown, 34 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `821b1dee`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- types.ts
- devDependencies
- dependencies
- 📋 Diagnóstico Detalhado por Módulo
- server.ts
- ⚽ Fut.Manager
- PlayerDomainCards.tsx
- App.tsx
- PlayerCard.tsx
- Guia de Deploy do Fut.Manager para Render + Supabase
- compilerOptions
- Home Composer Architecture Blueprint
- Supabase
- Writing Guidelines for Postgres References
- Automation.Lab Handoff
- Guia de Direção de Arte e Visual System
- TechnicalRanking.tsx
- User
- Concept Mapping and Relationships
- DashboardStatus.tsx
- Changelog
- Changelog
- Section Definitions
- authFetch
- Home Dynamic Visual Rendering
- Visão Geral da Arquitetura
- Home Dynamic Engine Design
- Visão Geral da Arquitetura
- Início Rápido
- EventManager.tsx
- Supabase Postgres Best Practices
- DrawManager.tsx
- AGENTS.md
- advanced-full-text-search.md
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- conn-limits.md
- conn-pooling.md
- conn-prepared-statements.md
- data-batch-inserts.md
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- query-missing-indexes.md
- query-partial-indexes.md
- schema-constraints.md
- schema-data-types.md
- schema-foreign-key-indexes.md
- schema-lowercase-identifiers.md
- schema-partitioning.md
- schema-primary-keys.md
- security-privileges.md
- security-rls-basics.md
- security-rls-performance.md
- _template.md
- source-map.md

## God Nodes (most connected - your core abstractions)
1. `authFetch()` - 34 edges
2. `User` - 29 edges
3. `DatabaseSchema` - 28 edges
4. `Player` - 23 edges
5. `useAppConfig()` - 22 edges
6. `📋 Diagnóstico Detalhado por Módulo` - 17 edges
7. `startServer()` - 16 edges
8. `compilerOptions` - 15 edges
9. `fetchAndSyncDb()` - 14 edges
10. `getSupabase()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `startServer()` --calls--> `readDb()`  [EXTRACTED]
  server.ts → server/db.ts
- `startServer()` --calls--> `syncMatchStatuses()`  [EXTRACTED]
  server.ts → server/db.ts
- `startServer()` --calls--> `writeDb()`  [EXTRACTED]
  server.ts → server/db.ts
- `DatabaseSchema` --references--> `Player`  [EXTRACTED]
  server/db.ts → src/types.ts
- `DatabaseSchema` --references--> `User`  [EXTRACTED]
  server/db.ts → src/types.ts

## Import Cycles
- None detected.

## Communities (70 total, 34 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.07
Nodes (66): ALL_DB_KEYS, autoArchiveMuralPosts(), captureSnapshot(), cloneDbForCaller(), DatabaseSchema, ensureDbExists(), fetchAndSyncDb(), GENERIC_TABLES (+58 more)

### Community 1 - "devDependencies"
Cohesion: 0.05
Nodes (40): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+32 more)

### Community 2 - "dependencies"
Cohesion: 0.05
Nodes (41): bcryptjs, compression, cors, dotenv, express, express-rate-limit, file-type, @google/genai (+33 more)

### Community 3 - "📋 Diagnóstico Detalhado por Módulo"
Cohesion: 0.05
Nodes (34): 10. Financeiro (Mensalistas, Goleiros e Reservas), 11. Eventos Sociais (Isenções de Churrasco), 12. Mural, Mídias e Exibições na Inicial, 13. Responsividade e Performance (Mobile First), 14. Migração de Hospedagem: Supabase + Render, 15. Hardening de Segurança (Correções Críticas), 16. Validação de Geração de Avatar com IA, 1. Cadastro, Autenticação e Vínculos (+26 more)

### Community 4 - "server.ts"
Cohesion: 0.10
Nodes (27): getJwtSecret(), hashPassword(), SessionTokenPayload, signSessionToken(), verifyPassword(), verifySessionToken(), AvatarProvider, AvatarProviderFactory (+19 more)

### Community 5 - "⚽ Fut.Manager"
Cohesion: 0.06
Nodes (29): Arquitetura, Comandos, Modelo de domínio essencial, O que é este projeto, OpenWiki, Arquivos-chave, Avaliações e Performance (Ranking), Calendário e Sorteio (Matches & Draws) (+21 more)

### Community 6 - "PlayerDomainCards.tsx"
Cohesion: 0.07
Nodes (26): PlayerAchievementsCard(), PlayerAchievementsCardProps, PlayerComparisonCard(), PlayerComparisonCardProps, PlayerGoalsCardProps, PlayerHistoryCardProps, PlayerIdentityCardProps, PlayerPerformanceCard() (+18 more)

### Community 7 - "App.tsx"
Cohesion: 0.13
Nodes (18): App(), NavTab, AuthMode, AuthScreensProps, FinanceManager(), AUDIT_PLAYERS, LaboratorioManager(), PlayerGoalsCard() (+10 more)

### Community 8 - "PlayerCard.tsx"
Cohesion: 0.16
Nodes (18): ClubShield(), getClubMolduraStyle(), PlayerCard(), PlayerCardProps, PlayerEvaluationModal(), PlayerEvaluationModalProps, PlayerForm(), PlayerFormProps (+10 more)

### Community 9 - "Guia de Deploy do Fut.Manager para Render + Supabase"
Cohesion: 0.11
Nodes (19): Guia de Deploy do Fut.Manager para Render + Supabase, Parte 1: Preparação e Setup Supabase, Parte 2: Criar o Schema Postgres, Parte 3: Configuração do Código, Parte 4: Deploy no Render, Passo 1.1: Criar projeto Supabase, Passo 1.2: Configurar variáveis de ambiente no dashboard Supabase, Passo 1.3: Criar Storage bucket para uploads (+11 more)

### Community 10 - "compilerOptions"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 11 - "Home Composer Architecture Blueprint"
Cohesion: 0.11
Nodes (17): 🏗️ 1. CONCEITO DO HOME COMPOSER, 🗂️ 2. DIMENSÕES DE CONTEXTO DO COMPOSER, 🎚️ 3. MATRIZ TRIDIMENSIONAL DE COMPOSIÇÃO DE INTERFACE, 🎨 4. ARQUITETURA MODULAR DO HERO (HERO COMPOSER), 🚀 5. EXPERIÊNCIA DOS TIMES SORTEADOS: "MEU TIME EM 1º LUGAR", 🏟️ 6. MODO ESPECIAL: DIA DO RACHA (`MATCH_DAY`), ⏱️ 7. FLUXO POS-JOGO INTEGRADO, ⚙️ 8. EXPERIÊNCIA DO ADMINISTRADOR (MODO INVISÍVEL) (+9 more)

### Community 12 - "Supabase"
Cohesion: 0.12
Nodes (14): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Making and Committing Schema Changes, Option A: Declarative schemas (+6 more)

### Community 13 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 14 - "Automation.Lab Handoff"
Cohesion: 0.12
Nodes (15): 2026-06-22, 2026-06-23, 2026-06-23 (Hotfix), 2026-06-24, 2026-07-04, Auditorias Encerradas, Automation.Lab Handoff, Bloqueio Prematuro de Sorteio (2026-06-22) (+7 more)

### Community 15 - "Guia de Direção de Arte e Visual System"
Cohesion: 0.14
Nodes (13): 🎨 1. CONCEITO CENTRAL: "APLICATIVO DE CLUBE", 📐 2. COMPOSIÇÃO DA HOME EM 5 CAMADAS VISUAIS, 🎨 3. PALETA DE CORES REGULAMENTAR, ✍️ 4. TIPOGRAFIA E RITMO VISUAL, ⚡ 5. MICROINTERAÇÕES E ANIMAÇÕES DINÂMICAS, 📱 6. DIRETRIZES MOBILE-FIRST E ACESSIBILIDADE, Camada 1 — Hero (O Protagonista), Camada 2 — Ação Principal (CTA Dominante) (+5 more)

### Community 16 - "TechnicalRanking.tsx"
Cohesion: 0.20
Nodes (9): ResponsiveTabsContainer(), ResponsiveTabsContainerProps, PlayerSummary, UserApprovalList(), UserApprovalListProps, PlayerCategory, PlayerPosition, UserRole (+1 more)

### Community 17 - "User"
Cohesion: 0.22
Nodes (11): CalendarManagerProps, CommunicationCenter(), CommunicationCenterProps, FinanceManagerProps, LaboratorioManagerProps, createResizedDataUrl(), MuralManager(), MuralManagerProps (+3 more)

### Community 18 - "Concept Mapping and Relationships"
Cohesion: 0.17
Nodes (11): 1. Technical Audit Report, 2. Security Hardening Report, 3. Deployment Guide, 4. Deployment Checklist, 5. Home Composer Architecture, 6. Dynamic Engine Design (Home Dynamic Architecture), 7. Visual System (Art Direction), 8. Home Dynamic (Visual Rendering) (+3 more)

### Community 19 - "DashboardStatus.tsx"
Cohesion: 0.24
Nodes (8): computeTacticalAssignments(), DashboardStatus(), DashboardStatusProps, SportsButton(), Achievement, getAchievementsForPlayer(), getRoundStatus(), RoundStatus

### Community 20 - "Changelog"
Cohesion: 0.18
Nodes (10): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), Bug Fixes, Bug Fixes, Bug Fixes, Changelog, Features (+2 more)

### Community 21 - "Changelog"
Cohesion: 0.18
Nodes (10): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), Bug Fixes, Bug Fixes, Bug Fixes, Changelog, Features (+2 more)

### Community 22 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 23 - "authFetch"
Cohesion: 0.31
Nodes (7): CalendarManager(), DetailPresences(), DetailRatings(), DetailTeams(), STATUS_METADATA, authFetch(), MatchStatus

### Community 24 - "Home Dynamic Visual Rendering"
Cohesion: 0.25
Nodes (7): 1. Filosofia de Design: "Central da Rodada", 2. Matriz de Visibilidade por Componente e Estado, 3. Estados da Rodada (Round States), 4. Hierarquia Visual Mobile-First, Home Dynamic Visual Rendering, Protocolo de Interface, Regra dos 3 Segundos

### Community 25 - "Visão Geral da Arquitetura"
Cohesion: 0.29
Nodes (6): Autenticação (`server/auth.ts`), Core Backend (`server.ts`), Frontend (`src/`), Persistência (`server/db.ts`), Visão Geral da Arquitetura, Visão Geral técnica

### Community 26 - "Home Dynamic Engine Design"
Cohesion: 0.29
Nodes (6): ETAPA 1 — INVENTÁRIO DE COMPONENTES ATUAIS, ETAPA 2 — MAPEAMENTO DOS ESTADOS DA RODADA, ETAPA 3 — MATRIZ DE VISIBILIDADE, 🗺️ FILOSOFIA DE DESIGN: "CENTRAL DA RODADA", Home Dynamic Engine Design, 🔗 Relacionamentos

### Community 27 - "Visão Geral da Arquitetura"
Cohesion: 0.29
Nodes (6): Autenticação (`server/auth.ts`), Core Backend (`server.ts`), Frontend (`src/`), Persistência (`server/db.ts`), Visão Geral da Arquitetura, Visão Geral técnica

### Community 28 - "Início Rápido"
Cohesion: 0.29
Nodes (6): Backlog, Como começar, Desenvolvimento, Estrutura da Documentação, Início Rápido, Principais Conceitos

### Community 29 - "EventManager.tsx"
Cohesion: 0.29
Nodes (6): EVENT_TYPE_CONFIG, EventManager(), EventManagerProps, STATUS_CONFIG, GrupalEventStatus, GrupalEventType

### Community 30 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 31 - "DrawManager.tsx"
Cohesion: 0.47
Nodes (5): computeTacticalAssignments(), DrawManager(), DrawManagerProps, getAbbreviation(), DrawTeam

## Knowledge Gaps
- **317 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+312 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `User` to `types.ts`, `server.ts`, `App.tsx`, `PlayerCard.tsx`, `TechnicalRanking.tsx`, `DashboardStatus.tsx`, `authFetch`, `EventManager.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `Player` connect `PlayerCard.tsx` to `types.ts`, `server.ts`, `PlayerDomainCards.tsx`, `App.tsx`, `TechnicalRanking.tsx`, `DashboardStatus.tsx`, `authFetch`, `DrawManager.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _317 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07080745341614907 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._