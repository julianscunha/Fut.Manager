---
type: Planning Document
title: Fut.Manager Documentation Migration Plan
description: Migration plan mapping from docs/ to /openwiki/ for Fut.Manager, including source evidence, target page locations, and cross-concept relationships.
tags: [migration, planning, fut-manager]
---

## Concept Mapping and Relationships

This document defines the migration of existing documentation from `/docs/` into the OpenWiki knowledge base under `/openwiki/`. Each entry outlines the source evidence, the target page location, the OKF front‑matter, and semantic relationships to other concepts.

### 1. Technical Audit Report  

| Aspect | Value |
|--------|-------|
| **Source** | `/docs/AUDITORIA.md` |
| **Target** | `/openwiki/architecture/audit-report.md` |
| **Type** | Technical Audit Report |
| **Human‑Readable Title** | Report de Auditoria Operacional e UX |
| **Description** | Consolidated technical audit covering business rule integrity, database consistency, statistical engine fixes, and mobile‑first responsiveness. Includes security hardening changes and frontend mobile bug fixes. |
| **Key Evidence** | Quality Mapping Table (§7), Module Diagnostics (§22‑68), and Security Hardening §15, Frontend Audit §16. |
| **Related Concepts** | `security.md` (security hardening details), `home-dynamic.md` (frontend visual fixes applied per audit).

### 2. Security Hardening Report  

| Aspect | Value |
|--------|-------|
| **Source** | `/docs/AUDITORIA.md` (excerpt §15) |
| **Target** | `/openwiki/architecture/security.md` |
| **Type** | Security Hardening Report |
| **Human‑Readable Title** | Hardening de Segurança Operacional |
| **Description** | Critical security fixes applied before public exposure: JWT‑based authentication, bcrypt password hashing, token validation, admin permission corrections, input validation, and CORS/Helmet hardening. |
| **Key Evidence** | §15 – 15 specific vulnerability fixes (impersonation, plaintext passwords, token validation, audit logging, role checking, upload validation, rate‑limiting, CORS/Helmet). |
| **Related Concepts** | `audit-report.md` (identifies security issues), `deploy-guide.md` (includes JWT secret and ALLOWED_ORIGINS env vars).

### 3. Deployment Guide  

| Aspect | Value |
|--------|-------|
| **Source** | `/docs/DEPLOY.md` |
| **Target** | `/openwiki/operations/deploy-guide.md` |
| **Type** | Deployment Guide |
| **Human‑Readable Title** | Guia de Deploy do Fut.Manager para Render + Supabase |
| **Description** | Step‑by‑step instructions to set up Supabase (schema, storage, admin user), configure .env.local, and deploy the container to Render, including verification steps and git checklist. |
| **Key Evidence** | §1‑§30 of DEPLOY.md (setup steps, schema SQL, authentication testing). |
| **Related Concepts** | `deploy-checklist.md` (complementary checklist), `security.md` (JWT secret and ALLOWED_ORIGINS).

### 4. Deployment Checklist  

| Aspect | Value |
|--------|-------|
| **Source** | `/docs/DEPLOY-CHECKLIST.md` |
| **Target** | `/openwiki/operations/deploy-checklist.md` |
| **Type** | Deployment Checklist |
| **Human‑Readable Title** | Checklist de Deploy — Fut.Manager (Supabase + Render) |
| **Description** | Detailed checklist covering Supabase preparation, code environment, local tests, and Git/repository hygiene required before exposing the system publicly. |
| **Key Evidence** | Sections 1‑38 of DEPLOY‑CHECKLIST.md (pre‑deploy, tests, Git workflow). |
| **Related Concepts** | `deploy-guide.md` (procedural narrative), `audit-report.md` (verifies schema integrity).

### 5. Home Composer Architecture  

| Aspect | Value |
|--------|-------|
| **Source** | `/docs/home_composer_architecture.md` |
| **Target** | `/openwiki/architecture/composer.md` |
| **Type** | Architecture Blueprint |
| **Human‑Readable Title** | Home Composer Architecture Blueprint |
| **Description** | Declarative blueprint for the Home Composer engine: three‑dimensional context layers (Round State, Athlete State, User Role) driving module composition, with a Mermaid diagram and explicit state mappings. |
| **Key Evidence** | §8‑31 (dimensions), §66‑124 (tri‑dimensional composition matrix). |
| **Related Concepts** | `dynamic-engine.md` (operational component visibility), `home-dynamic.md` (rendering decisions per context).

### 6. Dynamic Engine Design (Home Dynamic Architecture)  

| Aspect | Value |
|--------|-------|
| **Source** | `/docs/home_dynamic_architecture.md` |
| **Target** | `/openwiki/architecture/dynamic-engine.md` |
| **Type** | Dynamic Engine Design |
| **Human‑Readable Title** | Home Dynamic Engine Design |
| **Description** | Specification of the Home Dynamic UI: mobile‑first "Central of the Round" philosophy, component inventory per state, visibility matrix, and mobile‑first visual hierarchy across 10 game states. |
| **Key Evidence** | §8‑12 (design philosophy), §15‑31 (component inventory table), §35‑130 (state‑by‑state breakdown).
| **Related Concepts** | `composer.md` (context provider), `home-dynamic.md` (visual rendering guidelines).

### 7. Visual System (Art Direction)  

| Aspect | Value |
|--------|-------|
| **Source** | `/docs/home_art_direction.md` |
| **Target** | `/openwiki/design/visual-system.md` |
| **Type** | Visual System |
| **Human‑Readable Title** | Art Direction and Visual System |
| **Description** | Central design guidelines for Fut.Manager: color palette, typography, layer composition, micro‑interactions, and mobile‑first accessibility criteria, aligned with sports‑app aesthetics. |
| **Key Evidence** | §1‑3 (core concept), §4‑5 (layer composition diagram), §66‑115 (palettes, fonts, animations, mobile directives). |
| **Related Concepts** | `dynamic-engine.md` (UI components receive visual styling), `home-dynamic.md` (contextual rendering of styled components).

### 8. Home Dynamic (Visual Rendering)  

| Aspect | Value |
|--------|-------|
| **Source** | `/docs/home_dynamic_architecture.md` + `/docs/home_art_direction.md` (selected excerpts) |
| **Target** | `/openwiki/architecture/home-dynamic.md` |
| **Type** | Visual Rendering Specification |
| **Human‑Readable Title** | Home Dynamic Visual Rendering |
| **Description** | Combined specification of visual layering and rendering decisions for the Home Dynamic screen: the five‑layer vertical hierarchy, component placement per game state, and responsive layout constraints. |
| **Key Evidence** | §18‑39 (five‑layer diagram) from home_art_direction.md, integrated with component visibility per state from home_dynamic_architecture.md (matrix §70‑84). |
| **Related Concepts** | `composer.md` (context source), `dynamic-engine.md` (component inventory), `visual-system.md` (styling origins).

### 9. Handoff Documentation  

| Aspect | Value |
|--------|-------|
| **Source** | `/docs/handoff.md` |
| **Target** | `/openwiki/operations/handoff.md` |
| **Type** | Project Handoff Notes |
| **Human‑Readable Title** | Automation.Lab Handoff |
| **Description** | Executive summary of system status, chronological list of completed features, and resolved bugs, serving as a handoff artifact for future maintainers. |
| **Key Evidence** | §1‑75 (status table), §16‑... (chronological feature list).
| **Related Concepts** | `audit-report.md` (verifies technical correctness), `deploy-guide.md` (operational context for handoff).

## Summary  

The mapping above outlines the full transformation of the legacy `docs/` folder into a structured, interlinked OpenWiki knowledge base. Each target page is grounded in explicit source evidence, carries OKF‑compliant front matter, and is semantically linked to related concepts to maintain a coherent graph.

Key relationship patterns (→ indicates "informally supports / is implemented from"):

- **Composer Architecture** (composer.md) → **Dynamic Engine Design** (dynamic-engine.md) ; 
- **Dynamic Engine Design** (dynamic-engine.md) → **Home Dynamic Visual Rendering** (home-dynamic.md) ; 
- **Home Dynamic** (home-dynamic.md) → **Visual System** (visual-system.md) ; 
- **Visual System** (visual-system.md) → **Dynamic Engine Design** (dynamic-engine.md) ; 
- **Technical Audit Report** (audit-report.md) → **Security Hardening** (security.md) ; 
- **Security Hardening** (security.md) → **Deployment Guide** (deploy-guide.md) ; 
- **Deployment Guide** (deploy-guide.md) ↔ **Deployment Checklist** (deploy-checklist.md) ; 
- **Handoff Documentation** (handoff.md) ↔ **Audit Report** (audit-report.md) ↔ **Deployment Guide** (deploy-guide.md) .

These relationships ensure a navigable web of knowledge for developers, operators, and product owners.

**Next Steps**: Execute the generation of each target page by translating the source content, applying OKF front matter, and inserting explicit concept links per the relationship table above.

---