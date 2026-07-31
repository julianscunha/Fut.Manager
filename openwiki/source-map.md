---
type: "Reference"
title: "Repository Source Map"
openwiki_generated: true
---

<okf_front_matter>
---
type: Reference
title: Repository Source Map
description: A guided overview of the primary source code organization within the repository.
tags: [source-code, organization, navigation]
---
</okf_front_matter>

# Repository Source Map

This map outlines the core directories and files in the repository.

- `/src/`: Primary React source code.
    - `/src/components/`: Reusable UI components.
        - `DashboardStatus.tsx`: Dashboard with tactical assignments and presence management.
        - `UserApprovalList.tsx`: Admin interface for user approval workflow.
    - `/src/contexts/`: Global state management using React Context.
    - `/src/lib/`: Library integrations (e.g., Supabase client).
    - `/src/utils/`: Shared utilities.
    - `App.tsx`: Main application entry point and routing config.
- `/server/`: Modular server-side business logic.
    - `email.ts`: Email service (TurboSMTP integration).
    - `email-templates/`: Transactional email templates.
    - `avatarProvider.ts`: AI-powered avatar generation.
    - `auth.ts`: Authentication (bcrypt + JWT).
- `server.ts`: Initial Express entry point and routing orchestration.
    - `/api/auth/*`: Registration, login, password recovery
    - `/api/users/*`: Admin user management (approve/reject/link)
    - `/api/players/*`: Athlete profile management
    - `/api/matches/*`: Match scheduling and presence management
- `/data/`: Static data assets.
- `/openwiki/`: Project documentation organized by category (architecture, operations, design, guides).
