# Graph Report - Fut.Manager  (2026-08-02)

## Corpus Check
- 119 files · ~171,780 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 779 nodes · 1236 edges · 78 communities (42 shown, 36 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `92854fb1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- types.ts
- server.ts
- devDependencies
- dependencies
- Capability Matrix
- UI.tsx
- 📋 Diagnóstico Detalhado por Módulo
- App.tsx
- Guia de Deploy do Fut.Manager para Render + Supabase
- compilerOptions
- authFetch
- User Management Workflow
- Home Composer Architecture Blueprint
- Supabase
- Writing Guidelines for Postgres References
- Automation.Lab Handoff
- getPlayerAvatarUrl
- PlayerCard.tsx
- Guia de Direção de Arte e Visual System
- ⚽ Fut.Manager
- Section Definitions
- useAppConfig
- DashboardStatus.tsx
- command
- User
- Changelog
- Changelog
- Player Position Logic and Tactical Assignment
- manifest.json
- Supabase Postgres Best Practices
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
- openwiki/index.md
- Hardening de Segurança Operacional
- avatarProvider.ts
- README.md
- Visão Geral da Arquitetura
- pwa.md
- CLAUDE.md
- Início Rápido
- 📐 2. COMPOSIÇÃO DA HOME EM 5 CAMADAS VISUAIS
- Checklist de Deploy
- sw.js

## God Nodes (most connected - your core abstractions)
1. `authFetch()` - 34 edges
2. `User` - 29 edges
3. `DatabaseSchema` - 26 edges
4. `Player` - 23 edges
5. `startServer()` - 22 edges
6. `useAppConfig()` - 22 edges
7. `getPlayerAvatarUrl()` - 18 edges
8. `📋 Diagnóstico Detalhado por Módulo` - 17 edges
9. `baseHtml()` - 15 edges
10. `compilerOptions` - 15 edges

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

## Hyperedges (group relationships)
- **Fut.Manager Backend Core Modules** — server, server_db, server_auth, server_drawengine, server_statsengine, server_avatarprovider, server_email [EXTRACTED 0.95]
- **Fut.Manager Documentation Set** — openwiki_architecture, openwiki_quickstart, openwiki_source_map, openwiki_operations_deploy_guide, openwiki_operations_deploy_checklist, openwiki_guide_permissions [EXTRACTED 0.90]

## Communities (78 total, 36 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.07
Nodes (67): CLAUDE.md, ALL_DB_KEYS, autoArchiveMuralPosts(), captureSnapshot(), cloneDbForCaller(), DatabaseSchema, ensureDbExists(), fetchAndSyncDb() (+59 more)

### Community 1 - "server.ts"
Cohesion: 0.10
Nodes (37): getJwtSecret(), hashPassword(), SessionTokenPayload, signSessionToken(), verifyPassword(), verifySessionToken(), generateMonthlyBillingsIfNeeded(), getMonthlyFeeForDate() (+29 more)

### Community 2 - "devDependencies"
Cohesion: 0.05
Nodes (38): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+30 more)

### Community 3 - "dependencies"
Cohesion: 0.05
Nodes (40): bcryptjs, compression, cors, dotenv, express, express-rate-limit, file-type, @google/genai (+32 more)

### Community 4 - "Capability Matrix"
Cohesion: 0.13
Nodes (13): Files, Arquivos-chave, Avaliações e Performance (Ranking), Calendário e Sorteio (Matches & Draws), Capability Matrix, Display no Perfil do Atleta (`PlayerHero.tsx`), Eventos e Financeiro, Gestão de Atletas (Players) (+5 more)

### Community 5 - "UI.tsx"
Cohesion: 0.14
Nodes (10): SportsBadgeProps, SportsButton(), SportsButtonProps, SportsCard(), SportsCardProps, SportsContainerProps, SportsHeadingProps, SportsHeroProps (+2 more)

### Community 6 - "📋 Diagnóstico Detalhado por Módulo"
Cohesion: 0.11
Nodes (19): 10. Financeiro (Mensalistas, Goleiros e Reservas), 11. Eventos Sociais (Isenções de Churrasco), 12. Mural, Mídias e Exibições na Inicial, 13. Responsividade e Performance (Mobile First), 14. Migração de Hospedagem: Supabase + Render, 15. Hardening de Segurança (Correções Críticas), 16. Validação de Geração de Avatar com IA, 1. Cadastro, Autenticação e Vínculos (+11 more)

### Community 7 - "App.tsx"
Cohesion: 0.13
Nodes (21): NavTab, footLabel(), PlayerAchievementsCard(), PlayerAchievementsCardProps, PlayerComparisonCard(), PlayerComparisonCardProps, PlayerGoalsCard(), PlayerGoalsCardProps (+13 more)

### Community 8 - "Guia de Deploy do Fut.Manager para Render + Supabase"
Cohesion: 0.11
Nodes (19): Guia de Deploy do Fut.Manager para Render + Supabase, Parte 1: Preparação e Setup Supabase, Parte 2: Criar o Schema Postgres, Parte 3: Configuração do Código, Parte 4: Deploy no Render, Passo 1.1: Criar projeto Supabase, Passo 1.2: Configurar variáveis de ambiente no dashboard Supabase, Passo 1.3: Criar Storage bucket para uploads (+11 more)

### Community 9 - "compilerOptions"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 10 - "authFetch"
Cohesion: 0.15
Nodes (17): CalendarManager(), DetailPresences(), DetailRatings(), DetailTeams(), STATUS_METADATA, CommunicationCenter(), createResizedDataUrl(), MuralManager() (+9 more)

### Community 11 - "User Management Workflow"
Cohesion: 0.07
Nodes (26): 1. Approve User (`action: 'approve'`), 2. Reject User (`action: 'reject'`), 3. Update Role (`action: 'update_role'`), Access Control, Admin Dashboard Features, 👥 Admin Review (`POST /api/users/action`), Approval Actions Available, Authorization Matrix (+18 more)

### Community 12 - "Home Composer Architecture Blueprint"
Cohesion: 0.05
Nodes (37): 🏗️ 1. CONCEITO DO HOME COMPOSER, 🗂️ 2. DIMENSÕES DE CONTEXTO DO COMPOSER, 🎚️ 3. MATRIZ TRIDIMENSIONAL DE COMPOSIÇÃO DE INTERFACE, 🎨 4. ARQUITETURA MODULAR DO HERO (HERO COMPOSER), 🚀 5. EXPERIÊNCIA DOS TIMES SORTEADOS: "MEU TIME EM 1º LUGAR", 🏟️ 6. MODO ESPECIAL: DIA DO RACHA (`MATCH_DAY`), ⏱️ 7. FLUXO POS-JOGO INTEGRADO, ⚙️ 8. EXPERIÊNCIA DO ADMINISTRADOR (MODO INVISÍVEL) (+29 more)

### Community 13 - "Supabase"
Cohesion: 0.12
Nodes (14): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Making and Committing Schema Changes, Option A: Declarative schemas (+6 more)

### Community 14 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 15 - "Automation.Lab Handoff"
Cohesion: 0.12
Nodes (16): 2026-06-22, 2026-06-23, 2026-06-23 (Hotfix), 2026-06-24, 2026-07-04, 2026-07-31, Auditorias Encerradas, Automation.Lab Handoff (+8 more)

### Community 16 - "getPlayerAvatarUrl"
Cohesion: 0.31
Nodes (8): computeTacticalAssignments(), DrawManager(), DrawManagerProps, getAbbreviation(), FinanceManager(), DrawTeam, FALLBACK_SVG(), getPlayerAvatarUrl()

### Community 17 - "PlayerCard.tsx"
Cohesion: 0.15
Nodes (20): ClubShield(), getClubMolduraStyle(), PlayerCard(), PlayerEvaluationModal(), PlayerEvaluationModalProps, PlayerForm(), PlayerFormProps, PlayerHeroProps (+12 more)

### Community 18 - "Guia de Direção de Arte e Visual System"
Cohesion: 0.20
Nodes (8): Files, 🎨 1. CONCEITO CENTRAL: "APLICATIVO DE CLUBE", 🎨 3. PALETA DE CORES REGULAMENTAR, ✍️ 4. TIPOGRAFIA E RITMO VISUAL, ⚡ 5. MICROINTERAÇÕES E ANIMAÇÕES DINÂMICAS, 📱 6. DIRETRIZES MOBILE-FIRST E ACESSIBILIDADE, Guia de Direção de Arte e Visual System, Princípios Diretores:

### Community 19 - "⚽ Fut.Manager"
Cohesion: 0.17
Nodes (12): 🚀 Começando, 🤝 Contribuindo, ☁️ Deploy em produção, 📚 Documentação, ✨ Funcionalidades, ⚽ Fut.Manager, 📄 Licença, O que é isso (+4 more)

### Community 20 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 21 - "useAppConfig"
Cohesion: 0.20
Nodes (11): App(), AuthMode, AuthScreensProps, AUDIT_PLAYERS, LaboratorioManager(), TechnicalRanking(), AppConfig, AppConfigContext (+3 more)

### Community 22 - "DashboardStatus.tsx"
Cohesion: 0.31
Nodes (6): computeTacticalAssignments(), DashboardStatus(), Achievement, getAchievementsForPlayer(), getRoundStatus(), RoundStatus

### Community 23 - "command"
Cohesion: 0.11
Nodes (18): mcp, playwright, supabase, command, enabled, type, plugin, $schema (+10 more)

### Community 24 - "User"
Cohesion: 0.14
Nodes (14): CalendarManagerProps, CommunicationCenterProps, DashboardStatusProps, EVENT_TYPE_CONFIG, EventManager(), EventManagerProps, STATUS_CONFIG, FinanceManagerProps (+6 more)

### Community 25 - "Changelog"
Cohesion: 0.18
Nodes (10): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), Bug Fixes, Bug Fixes, Bug Fixes, Changelog, Features (+2 more)

### Community 26 - "Changelog"
Cohesion: 0.18
Nodes (10): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), Bug Fixes, Bug Fixes, Bug Fixes, Changelog, Features (+2 more)

### Community 27 - "Player Position Logic and Tactical Assignment"
Cohesion: 0.11
Nodes (17): Algoritmo de Atribuição Tática, Backtracking de Atribuição de Posições, Componentes Relacionados, Considerações Futuras, Contexto Visual, Erros Comuns Evitados, Estrutura de Posições de Jogadores, Exemplo de Lógica de Posição (+9 more)

### Community 28 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 29 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 64 - "openwiki/index.md"
Cohesion: 0.40
Nodes (3): Directories, Files, Repository Source Map

### Community 69 - "avatarProvider.ts"
Cohesion: 0.22
Nodes (4): AvatarProvider, AvatarProviderFactory, GeminiAvatarProvider, OpenRouterAvatarProvider

### Community 71 - "Visão Geral da Arquitetura"
Cohesion: 0.22
Nodes (9): Autenticação (`server/auth.ts`), Core Backend (`server.ts`), Frontend (`src/`), Integração com Fluxo de Trabalho de Usuários, Notificações e E-mails (`server/email.ts`), Persistência (`server/db.ts`), Template de E-mail, Visão Geral da Arquitetura (+1 more)

### Community 72 - "pwa.md"
Cohesion: 0.22
Nodes (8): 1. Web App Manifest, 2. Service Worker, 3. Integration with the Front‑End, 4. Building & Deploying, 5. Testing the PWA, Backlog, Overview, Service Worker Flow Diagram

### Community 73 - "CLAUDE.md"
Cohesion: 0.29
Nodes (5): Arquitetura, Comandos, Modelo de domínio essencial, O que é este projeto, OpenWiki

### Community 74 - "Início Rápido"
Cohesion: 0.29
Nodes (7): Backlog, Como começar, Desenvolvimento, Estrutura da Documentação, Início Rápido, Principais Conceitos, Progressive Web App (PWA)

### Community 75 - "📐 2. COMPOSIÇÃO DA HOME EM 5 CAMADAS VISUAIS"
Cohesion: 0.33
Nodes (6): 📐 2. COMPOSIÇÃO DA HOME EM 5 CAMADAS VISUAIS, Camada 1 — Hero (O Protagonista), Camada 2 — Ação Principal (CTA Dominante), Camada 3 — Status Pessoal (A "Ficha" de Jogador), Camada 4 — Status do Grupo (O Vestiário), Camada 5 — Social (A Resenha de Fim de Jogo)

### Community 76 - "Checklist de Deploy"
Cohesion: 0.40
Nodes (5): 1. Pré-Deploy - Supabase, 2. Pré-Deploy - Render / Docker, 3. Deploy no Render, 4. Pós-Deploy, Checklist de Deploy

## Knowledge Gaps
- **369 isolated node(s):** `$schema`, `file:///D:/Github/Fut.Manager/.kilo/plugins/graphify.js`, `snapshot`, `type`, `url` (+364 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Why does `AuthScreens()` connect `dependencies` to `useAppConfig`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **What connects `$schema`, `file:///D:/Github/Fut.Manager/.kilo/plugins/graphify.js`, `snapshot` to the rest of the system?**
  _369 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06841046277665996 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10204081632653061 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._