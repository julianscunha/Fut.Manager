# Graph Report - .  (2026-08-03)

## Corpus Check
- 145 files · ~177,116 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 778 nodes · 1433 edges · 52 communities (42 shown, 10 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.83)
- Token cost: 0 input · 713,583 output

## Community Hubs (Navigation)
- Persistencia e Estatisticas do Backend
- Nucleo do Servidor (Auth/Draw/Email)
- Dependencias de Backend/Runtime
- Dependencias de Build/Dev
- Scripts caveman-compress (compress/detect)
- Nova Infra API Client/AuthContext (opt-in)
- Skill Supabase (docs)
- Familia de Skills Caveman/Cavecrew
- Configuracao TypeScript (tsconfig)
- Componentes de Jogador (Card/Ranking)
- Scripts caveman-compress (benchmark/validate)
- Cards de Dominio do Jogador
- Postgres Best Practices (schema/query/security)
- CLAUDE.md e Referencias de Arquitetura
- Configuracao .kilo/MCP
- Componentes Sociais/Financeiro (Mural/Finance)
- Componentes de Notificacao/Aprovacao de Usuario
- Home Composer e Fluxo de Sorteio
- Deploy e Operacoes
- Design System (Sports UI Kit)
- Auditoria Operacional (Bugs Conhecidos)
- Componentes da Home Dinamica
- Auth Screens e Laboratorio
- Dashboard e Status da Rodada
- Estados da Rodada (Maquina de Estados)
- Manifest PWA
- Diretivas de Agente Duplicadas (Caveman/Graphify/OpenWiki)
- Indice do OpenWiki
- Gestao de Calendario/Partidas
- PWA Shell (index.html/sw.js)
- Sistema Visual (Design)
- Permissoes e Mapa do Repositorio
- Logica de Posicao de Jogador
- Fluxo de Gestao de Usuarios
- Gestao de Eventos Sociais
- Workflow OpenWiki Update
- Gestao de Sorteio (DrawManager)
- Entry Point (main.tsx)
- Script init (caveman-compress)
- Icone PWA 192
- Icone PWA 512
- Service Worker (Cache Estatico)
- Regra Caveman (Cline)
- GitHub Funding Config
- Funding: Buy Me a Coffee
- Doc de Seguranca (Referencia)
- Instrucoes do OpenWiki
- Favicon

## God Nodes (most connected - your core abstractions)
1. `User` - 31 edges
2. `DatabaseSchema` - 25 edges
3. `CLAUDE.md (Project Root)` - 25 edges
4. `Player` - 24 edges
5. `Supabase Postgres Best Practices Skill` - 20 edges
6. `getPlayerAvatarUrl()` - 18 edges
7. `authFetch()` - 17 edges
8. `baseHtml()` - 17 edges
9. `Visão Geral da Arquitetura (openwiki/architecture.md)` - 17 edges
10. `compress_file()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Round States (STANDBY/CONFIRMING/CLOSED/DRAWN/MATCH_DAY/LIVE/AWAITING_EVALUATION/FINISHED)` --semantically_similar_to--> `Matriz de Visibilidade (10 Estados)`  [INFERRED] [semantically similar]
  openwiki/architecture/home-dynamic.md → openwiki/architecture/dynamic-engine.md
- `startServer()` --calls--> `generateMonthlyBillingsIfNeeded()`  [EXTRACTED]
  server.ts → server/db.ts
- `startServer()` --calls--> `getSupabaseClient()`  [EXTRACTED]
  server.ts → server/db.ts
- `startServer()` --calls--> `readDb()`  [EXTRACTED]
  server.ts → server/db.ts
- `startServer()` --calls--> `syncMatchStatuses()`  [EXTRACTED]
  server.ts → server/db.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Caveman skill family (caveman, caveman-commit, caveman-review, caveman-compress, caveman-help)** — _agents_skills_caveman_help_skill_caveman_commit, _agents_skills_caveman_help_skill_caveman_review, _agents_skills_caveman_help_skill_caveman_compress, _agents_skills_caveman_help_skill_caveman_help [EXTRACTED 1.00]
- **Locate to fix to verify subagent chain** — _agents_skills_cavecrew_skill_cavecrew_investigator, _agents_skills_cavecrew_skill_cavecrew_builder, _agents_skills_cavecrew_skill_cavecrew_reviewer [EXTRACTED 1.00]
- **caveman-stats hook-delivered output mechanism** — _agents_skills_caveman_stats_skill_caveman_stats_js, _agents_skills_caveman_stats_skill_caveman_mode_tracker_hook [EXTRACTED 1.00]
- **Postgres Connection Management Pattern** — agents_skills_supabase_postgres_best_practices_references_conn_limits, agents_skills_supabase_postgres_best_practices_references_conn_pooling, agents_skills_supabase_postgres_best_practices_references_conn_idle_timeout, agents_skills_supabase_postgres_best_practices_references_conn_prepared_statements [INFERRED 0.85]
- **Postgres Concurrency & Locking Pattern** — agents_skills_supabase_postgres_best_practices_references_lock_advisory, agents_skills_supabase_postgres_best_practices_references_lock_deadlock_prevention, agents_skills_supabase_postgres_best_practices_references_lock_short_transactions [INFERRED 0.85]
- **Data Access Optimization Pattern** — agents_skills_supabase_postgres_best_practices_references_data_batch_inserts, agents_skills_supabase_postgres_best_practices_references_data_n_plus_one, agents_skills_supabase_postgres_best_practices_references_data_pagination, agents_skills_supabase_postgres_best_practices_references_data_upsert [INFERRED 0.85]
- **Multi-Tenant Security Posture (RLS + Privilege + Performance)** — agents_skills_supabase_postgres_best_practices_references_security_rls_basics_rls_basics, agents_skills_supabase_postgres_best_practices_references_security_rls_performance_rls_performance, agents_skills_supabase_postgres_best_practices_references_security_privileges_privileges [INFERRED 0.75]
- **Index Strategy Selection Pattern** — agents_skills_supabase_postgres_best_practices_references_query_missing_indexes_missing_indexes, agents_skills_supabase_postgres_best_practices_references_query_composite_indexes_composite_indexes, agents_skills_supabase_postgres_best_practices_references_query_index_types_index_types [INFERRED 0.70]
- **Schema Design Fundamentals** — agents_skills_supabase_postgres_best_practices_references_schema_primary_keys_primary_keys, agents_skills_supabase_postgres_best_practices_references_schema_data_types_data_types, agents_skills_supabase_postgres_best_practices_references_schema_foreign_key_indexes_foreign_key_indexes [INFERRED 0.70]
- **Cross-file Agent Directive Stack (OpenWiki + Graphify + Caveman)** — claude_md_openwiki_section, agents_md_graphify_section, windsurf_rules_caveman [INFERRED 0.80]
- **Known Bugs Cross-Referenced from CLAUDE.md into audit-report.md** — openwiki_architecture_audit_report_affinity_dup_bug, openwiki_architecture_audit_report_streak_bug, claude_md_draw_flow [EXTRACTED 1.00]
- **Home Composer Tridimensional Context Model** — openwiki_architecture_composer_round_state, openwiki_architecture_composer_athlete_state, openwiki_architecture_composer_user_role [EXTRACTED 1.00]
- **Home Dynamic Visibility Specification (Engine + Rendering + Visual System)** — openwiki_architecture_dynamic_engine_matriz_visibilidade, openwiki_architecture_home_dynamic_round_states, openwiki_design_visual_system_5_camadas_visuais [INFERRED 0.85]
- **Tactical Assignment Pipeline (players -> dashboard -> draw)** — src_components_dashboardstatus, openwiki_architecture_players_computetacticalassignments, server_drawengine_ts [INFERRED 0.85]
- **User Approval → Role Assignment → Athlete Category Flow** — openwiki_guide_user_management_admin_review, openwiki_guide_permissions_role_category_mapping, src_components_userapprovallist [INFERRED 0.80]
- **Fut.Manager Backend Core Modules** — server, server_db, server_auth, server_drawengine, server_statsengine, server_avatarprovider, server_email [EXTRACTED 0.95]
- **Fut.Manager Documentation Set** — openwiki_architecture, openwiki_quickstart [EXTRACTED 0.90]

## Communities (52 total, 10 thin omitted)

### Community 0 - "Persistencia e Estatisticas do Backend"
Cohesion: 0.07
Nodes (65): ALL_DB_KEYS, autoArchiveMuralPosts(), captureSnapshot(), cloneDbForCaller(), DatabaseSchema, ensureDbExists(), fetchAndSyncDb(), generateMonthlyBillingsIfNeeded() (+57 more)

### Community 1 - "Nucleo do Servidor (Auth/Draw/Email)"
Cohesion: 0.09
Nodes (34): CLAUDE.md, getJwtSecret(), hashPassword(), SessionTokenPayload, signSessionToken(), verifyPassword(), verifySessionToken(), AvatarProvider (+26 more)

### Community 2 - "Dependencias de Backend/Runtime"
Cohesion: 0.05
Nodes (40): bcryptjs, compression, cors, dotenv, express, express-rate-limit, file-type, @google/genai (+32 more)

### Community 3 - "Dependencias de Build/Dev"
Cohesion: 0.05
Nodes (38): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+30 more)

### Community 4 - "Scripts caveman-compress (compress/detect)"
Cohesion: 0.10
Nodes (33): main(), print_usage(), backup_dir_for(), build_compress_prompt(), build_fix_prompt(), call_claude(), compress_file(), first_nonblank_line() (+25 more)

### Community 5 - "Nova Infra API Client/AuthContext (opt-in)"
Cohesion: 0.08
Nodes (14): ApiClient, ApiError, ApiRequestInit, ErrorBoundary, Props, State, AppConfigProvider(), AuthContext (+6 more)

### Community 6 - "Skill Supabase (docs)"
Cohesion: 0.09
Nodes (35): Skill Feedback Issue Template, Supabase Skill Changelog, Supabase Postgres Best Practices Changelog, Writing Guidelines for Postgres References (_contributing.md), Section Definitions (_sections.md), Rule Reference Template (_template.md), Use tsvector for Full-Text Search, Index JSONB Columns for Efficient Querying (+27 more)

### Community 7 - "Familia de Skills Caveman/Cavecrew"
Cohesion: 0.06
Nodes (32): cavecrew, cavecrew-builder, cavecrew-investigator, cavecrew-reviewer, Code Reviewer (vanilla agent), Explore (vanilla agent), feature-dev:code-architect, Conventional Commits format (+24 more)

### Community 8 - "Configuracao TypeScript (tsconfig)"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2022, ./src/api/*, ./src/components/*, ./src/contexts/*, ./src/lib/*, ./src/types/* (+22 more)

### Community 9 - "Componentes de Jogador (Card/Ranking)"
Cohesion: 0.15
Nodes (22): ClubShield(), getClubMolduraStyle(), PlayerCard(), PlayerCardProps, PlayerEvaluationModal(), PlayerEvaluationModalProps, PlayerHero(), PlayerHeroProps (+14 more)

### Community 10 - "Scripts caveman-compress (benchmark/validate)"
Cohesion: 0.15
Nodes (23): benchmark_pair(), count_tokens(), main(), print_table(), Path, count_bullets(), extract_code_blocks(), extract_headings() (+15 more)

### Community 11 - "Cards de Dominio do Jogador"
Cohesion: 0.13
Nodes (19): NavTab, footLabel(), PlayerAchievementsCard(), PlayerAchievementsCardProps, PlayerComparisonCard(), PlayerComparisonCardProps, PlayerGoalsCard(), PlayerGoalsCardProps (+11 more)

### Community 12 - "Postgres Best Practices (schema/query/security)"
Cohesion: 0.20
Nodes (21): Use SKIP LOCKED for Non-Blocking Queue Processing, Use EXPLAIN ANALYZE to Diagnose Slow Queries, Enable pg_stat_statements for Query Analysis, Maintain Table Statistics with VACUUM and ANALYZE, Create Composite Indexes for Multi-Column Queries, Use Covering Indexes to Avoid Table Lookups, Choose the Right Index Type for Your Data, Add Indexes on WHERE and JOIN Columns (+13 more)

### Community 13 - "CLAUDE.md e Referencias de Arquitetura"
Cohesion: 0.14
Nodes (21): CLAUDE.md (Project Root), Sorteio de Times Flow (draw→update-manual→confirm-lock), openwiki/operations/deploy-guide.md (referenced), PlayerCategory (mensalista, reserva), PUBLIC_API_ROUTES Allowlist, server/email.ts, server.ts (Core Backend), src/api/client.ts (ApiClient) (+13 more)

### Community 14 - "Configuracao .kilo/MCP"
Cohesion: 0.11
Nodes (18): mcp, playwright, supabase, command, enabled, type, plugin, $schema (+10 more)

### Community 15 - "Componentes Sociais/Financeiro (Mural/Finance)"
Cohesion: 0.19
Nodes (13): CommunicationCenterProps, DashboardStatusProps, FinanceManager(), FinanceManagerProps, createResizedDataUrl(), MuralManager(), MuralManagerProps, resizeImage() (+5 more)

### Community 16 - "Componentes de Notificacao/Aprovacao de Usuario"
Cohesion: 0.16
Nodes (12): NotificationCenter(), NotificationCenterProps, PlayerForm(), PlayerFormProps, UserApprovalListProps, authFetch(), NotificationCategory, PlayerCategory (+4 more)

### Community 17 - "Home Composer e Fluxo de Sorteio"
Cohesion: 0.12
Nodes (16): Match Lifecycle (agendada→confirmando→encerrada/cancelada), Fila de Reservas (reservesOrder), server/drawEngine.ts, Home Composer Architecture Blueprint, Experiência do Administrador (Modo Invisível), Athlete State Dimension (PENDING..GUEST), Hero Composer (3-layer Hero), Modo Dia do Racha (MATCH_DAY) (+8 more)

### Community 18 - "Deploy e Operacoes"
Cohesion: 0.17
Nodes (16): CLAUDE.md (root), Dockerfile, docs/DEPLOY.md, Checklist de Deploy — Fut.Manager (Supabase + Render), Guia de Deploy do Fut.Manager para Render + Supabase, 2026-07-31 Handoff Entry (Storage cleanup, Destaque da Semana, Email templates), Automation.Lab Handoff, Mural V2 — Museu do Clube (+8 more)

### Community 19 - "Design System (Sports UI Kit)"
Cohesion: 0.13
Nodes (11): SportsBadgeProps, SportsButtonProps, SportsCard(), SportsCardProps, SportsContainerProps, SportsHeadingProps, SportsHeroProps, SportsIndicator() (+3 more)

### Community 20 - "Auditoria Operacional (Bugs Conhecidos)"
Cohesion: 0.14
Nodes (14): openwiki/architecture/audit-report.md (referenced), server/auth.ts, server/avatarProvider.ts, server/db.ts, server/statsEngine.ts, Relatório de Auditoria Operacional e UX (openwiki/architecture/audit-report.md), Autenticação JWT + bcrypt (substitui x-user-id), Correção de Race Condition na Geração de Avatar IA (+6 more)

### Community 21 - "Componentes da Home Dinamica"
Cohesion: 0.21
Nodes (12): Ações Rápidas do Administrador, Assistente de Vinculação, CTA Confirmar Presença, Destaques da Última Rodada, Estatísticas e Conquistas, Hero Match Card, Inventário de Componentes da Home (Etapa 1), Mural de Avisos (Destaque) (+4 more)

### Community 22 - "Auth Screens e Laboratorio"
Cohesion: 0.24
Nodes (9): AuthMode, AuthScreensProps, AUDIT_PLAYERS, LaboratorioManager(), LaboratorioManagerProps, AppConfig, AppConfigContext, BrandName() (+1 more)

### Community 23 - "Dashboard e Status da Rodada"
Cohesion: 0.23
Nodes (7): computeTacticalAssignments(), DashboardStatus(), SportsButton(), Achievement, getAchievementsForPlayer(), getRoundStatus(), RoundStatus

### Community 24 - "Estados da Rodada (Maquina de Estados)"
Cohesion: 0.18
Nodes (11): ESTADO_AVALIACOES_POST_JOGO, ESTADO_CONVOCACAO_ABERTA, ESTADO_DIA_DO_JOGO, ESTADO_LISTA_FECHADA, ESTADO_LIVE_MATCH, ESTADO_MUSEU_SINCED, ESTADO_PRESENCA_CONFIRMADA, ESTADO_RESULTADO_DIVULGADO (+3 more)

### Community 25 - "Manifest PWA"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 26 - "Diretivas de Agente Duplicadas (Caveman/Graphify/OpenWiki)"
Cohesion: 0.29
Nodes (9): Caveman Response Rules (AGENTS.md), Graphify Section (AGENTS.md), OpenWiki Section (AGENTS.md), OpenWiki Section (CLAUDE.md), Caveman Response Style (Copilot Instructions), Graphify Copilot Instructions, OpenWiki Copilot Instructions, peter-evans/create-pull-request@v7 (+1 more)

### Community 27 - "Indice do OpenWiki"
Cohesion: 0.27
Nodes (10): Filosofia Central da Rodada, Home Dynamic Engine Design, Home Dynamic Visual Rendering, Regra dos 3 Segundos, Round States (STANDBY/CONFIRMING/CLOSED/DRAWN/MATCH_DAY/LIVE/AWAITING_EVALUATION/FINISHED), Architecture Index, Visão Geral da Arquitetura, Hardening de Segurança Operacional (+2 more)

### Community 28 - "Gestao de Calendario/Partidas"
Cohesion: 0.22
Nodes (4): CalendarManager(), CalendarManagerProps, STATUS_METADATA, MatchStatus

### Community 29 - "PWA Shell (index.html/sw.js)"
Cohesion: 0.29
Nodes (8): index.html (App Shell), Cloudflare Turnstile Script Tag, SEO/OG/Twitter Meta Tags, Cache-First / Network-First Service Worker Strategy, Progressive Web App (PWA) Implementation, public/manifest.json, public/sw.js, src/main.tsx

### Community 30 - "Sistema Visual (Design)"
Cohesion: 0.25
Nodes (8): Protocolo de Interface Mobile-First, Design Index, Conceito Aplicativo de Clube, Guia de Direção de Arte e Visual System, Microinterações e Animações Dinâmicas, Diretrizes Mobile-First e Acessibilidade (WCAG AAA), Paleta de Cores Regulamentar, Tipografia e Ritmo Visual (Space Grotesk, JetBrains Mono, Inter)

### Community 31 - "Permissoes e Mapa do Repositorio"
Cohesion: 0.29
Nodes (8): Guide Index, Capability Matrix (admin/auxiliar/jogador), Permissões do Sistema, Correção de Bloqueio Prematuro de Re-sorteios (redrawCount >= 2), Repository Source Map, server.ts, src/App.tsx, UserRole type (src/types.ts:6)

### Community 32 - "Logica de Posicao de Jogador"
Cohesion: 0.29
Nodes (7): Lista de Confirmados (Grid), Backtracking de Atribuição de Posições (sistema de pontuação), computeTacticalAssignments(), HomeComposer, Player Position Logic and Tactical Assignment, Regra de Exclusão de Goleiro, server/drawEngine.ts

### Community 33 - "Fluxo de Gestao de Usuarios"
Cohesion: 0.29
Nodes (7): Mapeamento Role → Athlete Category, Admin Review (POST /api/users/action), Position Assignment Logic (New Athlete Profiles), Registration Process (POST /api/auth/register), User Approval State Machine, User Management Workflow, server/db.ts

### Community 34 - "Gestao de Eventos Sociais"
Cohesion: 0.29
Nodes (6): EVENT_TYPE_CONFIG, EventManager(), EventManagerProps, STATUS_CONFIG, GrupalEventStatus, GrupalEventType

### Community 35 - "Workflow OpenWiki Update"
Cohesion: 0.33
Nodes (6): OpenWiki Update GitHub Actions Workflow, actions/checkout@v4, actions/setup-node@v4, LangSmith Tracing Integration (openwiki workflow), OPENWIKI_PROVIDER: openrouter, openwiki CLI (openwiki@0.2.4)

### Community 36 - "Gestao de Sorteio (DrawManager)"
Cohesion: 0.47
Nodes (5): computeTacticalAssignments(), DrawManager(), DrawManagerProps, getAbbreviation(), DrawTeam

### Community 37 - "Entry Point (main.tsx)"
Cohesion: 0.50
Nodes (4): src/App.tsx, src/contexts/AuthContext.tsx, /src/main.tsx (module entry script), src/main.tsx (AuthProvider mount)

## Knowledge Gaps
- **211 isolated node(s):** `SessionTokenPayload`, `AdvancedDuoStat`, `AdvancedTrioStat`, `NotificationCenterProps`, `SportsCardProps` (+206 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Dependencias de Backend/Runtime` to `Dependencias de Build/Dev`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `AuthScreens()` connect `Dependencias de Backend/Runtime` to `Auth Screens e Laboratorio`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **What connects `SessionTokenPayload`, `AdvancedDuoStat`, `AdvancedTrioStat` to the rest of the system?**
  _211 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Persistencia e Estatisticas do Backend` be split into smaller, more focused modules?**
  _Cohesion score 0.07067603160667252 - nodes in this community are weakly interconnected._
- **Should `Nucleo do Servidor (Auth/Draw/Email)` be split into smaller, more focused modules?**
  _Cohesion score 0.08888888888888889 - nodes in this community are weakly interconnected._
- **Should `Dependencias de Backend/Runtime` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Dependencias de Build/Dev` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._