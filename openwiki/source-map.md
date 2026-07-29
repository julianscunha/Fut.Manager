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
    - `/src/contexts/`: Global state management using React Context.
    - `/src/lib/`: Library integrations (e.g., Supabase client).
    - `/src/utils/`: Shared utilities.
    - `App.tsx`: Main application entry point and routing config.
- `/server/`: Modular server-side business logic.
- `server.ts`: Initial Express entry point and routing orchestration.
- `/data/`: Static data assets.
- `/openwiki/`: Project documentation organized by category (architecture, operations, design, guides).
