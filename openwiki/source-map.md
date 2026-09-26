---
type: Referência
title: Mapa de Origem do Repositório
description: Uma visão geral guiada da organização principal do código-fonte dentro do repositório.
tags: [source-code, organization, navigation]
---

# Mapa de Origem do Repositório

Este mapa descreve os principais diretórios e arquivos do repositório.

- `/src/`: Código-fonte principal do React.
    - `/src/components/`: Componentes de UI reutilizáveis.
        - `DashboardStatus.tsx`: Painel com atribuições táticas e gerenciamento de presença.
        - `UserApprovalList.tsx`: Interface de administrador para fluxo de aprovação de usuários.
    - `/src/contexts/`: Gerenciamento de estado global usando React Context.
    - `/src/lib/`: Integrações de biblioteca (ex.: cliente Supabase).
    - `/src/utils/`: Utilitários compartilhados.
    - `App.tsx`: Ponto de entrada principal do aplicativo e configuração de roteamento.
- `/server/`: Lógica de negócios modular do lado do servidor.
    - `email.ts`: Serviço de e-mail (integração com TurboSMTP).
    - `email-templates/`: Modelos de e-mail transacionais.
    - `avatarProvider.ts`: Geração de avatares com IA.
    - `auth.ts`: Autenticação (bcrypt + JWT).
- `server.ts`: Ponto de entrada do Express — API REST centralizada (`/api/*`) em arquivo único, sem roteamento modularizado.
- `/openwiki/`: Documentação do projeto organizada por categoria (arquitetura, operações, design, guias).