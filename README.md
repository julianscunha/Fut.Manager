# ⚽ Racha do Fofim

**O cockpit completo para quem administra um racha.** Mensalistas, reservas, sorteio de times equilibrado, financeiro, mural social e ranking técnico — tudo em um só lugar, pensado para ser usado no campo, pelo celular, minutos antes da bola rolar.

[![License: MIT](https://img.shields.io/badge/license-MIT-10b981.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](package.json)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Storage-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Deploy](https://img.shields.io/badge/deploy-Render-46E3B7?logo=render&logoColor=white)](docs/DEPLOY.md)

---

## O que é isso

Todo grupo de futebol society passa pelas mesmas dores: quem vai jogar, quem paga o quê, como sortear times justos, onde ficam as fotos da resenha e quem realmente é bom em campo. O **Racha do Fofim** resolve tudo isso em um único aplicativo web, mobile-first, para o administrador do grupo (e para cada atleta) usar sem depender de planilha, grupo de WhatsApp lotado de enquete ou papel.

Nasceu como o sistema real de um grupo de futebol (o "Racha do Fofim") e evoluiu para uma plataforma completa e **white-label** — hoje roda em produção sobre Postgres (Supabase), é hospedável em qualquer lugar que rode um container Docker, e o nome exibido na interface é 100% configurável: defina a variável `APP_NAME` no seu `.env` com o nome do seu próprio grupo e ele se propaga automaticamente por toda a UI, notificações e mensagens de compartilhamento — sem tocar em nenhuma linha de código.

## ✨ Funcionalidades

- **Gestão de atletas** — cadastro completo, categorias (mensalista/reserva), soft delete que preserva histórico e ranking mesmo após saída do jogador.
- **Sorteio inteligente de times** — algoritmo Monte Carlo (até 5.000 iterações) que equilibra Overall, garante presença mínima de posições defensivas/ofensivas por time e aprende afinidades históricas de duplas e trios.
- **Confirmação de presença e fila de reservas** — deadline configurável, convocação automática de reservas por ordem de fila quando um mensalista cancela.
- **Financeiro** — cobrança mensal automática, isenção de goleiros/reservas, controle de pagamentos e eventos sociais (churrascos, confraternizações) com regras de isenção próprias.
- **Ranking técnico e Hall da Fama** — avaliações por atributo (defesa, passe, finalização, drible, físico...), Overall calculado, streaks por temporada, duplas/trios mais fortes.
- **Museu do Clube** — mural social com galeria de memórias, momentos épicos, linha do tempo de rodadas e central de comunicação/avisos.
- **Avatares de jogador com IA** — geração automática de card/retrato esportivo a partir da foto do atleta, via OpenRouter ou Gemini.
- **Feito para o campo** — interface mobile-first de verdade: alvos de toque generosos, tabelas que viram cards no celular, menus que não quebram em tela pequena.
- **White-label por variável de ambiente** — o nome do seu grupo (`APP_NAME`) é a única coisa que muda entre a sua instalação e a de qualquer outra pessoa que clonar este projeto. Nenhum dado pessoal ou nome de grupo fica hardcoded no código-fonte.

## 🧱 Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express (processo único, serve API e frontend) |
| Banco de dados | PostgreSQL via [Supabase](https://supabase.com) |
| Armazenamento de mídia | Supabase Storage |
| Autenticação | JWT próprio + bcrypt (sem dependência do Supabase Auth) |
| Geração de avatar (IA) | [OpenRouter](https://openrouter.ai) (recomendado) ou Google Gemini |
| Hospedagem | [Render](https://render.com) (Web Service via Docker) |

Arquitetura de monólito único e deliberada: o mesmo processo Express serve a API REST e o build estático do frontend, o que mantém o custo de hospedagem baixo (um serviço só) sem abrir mão de nenhuma funcionalidade.

## 🚀 Começando

### Pré-requisitos

- Node.js 20+
- Uma conta [Supabase](https://supabase.com) (plano free cobre o uso de um racha comum)
- Opcional: uma chave [OpenRouter](https://openrouter.ai/keys) ou [Gemini](https://ai.google.dev) para geração de avatar com IA

### Setup local

```bash
git clone https://github.com/julianscunha/Fut.Manager.git
cd Fut.Manager
npm install
cp .env.example .env.local   # defina APP_NAME com o nome do seu grupo, credenciais do Supabase, JWT_SECRET, etc.
npm run dev
```

Acesse `http://localhost:3000`. Login padrão criado pelo schema inicial: `admin@racha.com` / `admin` — **troque essa senha antes de expor o sistema publicamente**.

### Scripts disponíveis

```bash
npm run dev      # servidor de desenvolvimento (tsx + Vite em middleware mode, com HMR)
npm run build     # build de produção (frontend via Vite + backend via esbuild)
npm start       # roda o build de produção
npm run lint      # type-check (tsc --noEmit)
npm run clean     # remove dist/
```

## ☁️ Deploy em produção

Guia completo, passo a passo, para colocar seu próprio racha no ar (setup do Supabase, schema SQL, variáveis de ambiente, deploy no Render): **[docs/DEPLOY.md](docs/DEPLOY.md)**.

Antes de ir ao ar, use o **[docs/DEPLOY-CHECKLIST.md](docs/DEPLOY-CHECKLIST.md)** para conferir cada etapa de segurança e funcionamento.

## 📚 Documentação

Toda a documentação de arquitetura, decisões de produto e auditorias vive em [`docs/`](docs/):

| Documento | Conteúdo |
|---|---|
| [DEPLOY.md](docs/DEPLOY.md) | Guia completo de deploy (Supabase + Render) |
| [DEPLOY-CHECKLIST.md](docs/DEPLOY-CHECKLIST.md) | Checklist de verificação pré/pós-deploy |
| [AUDITORIA.md](docs/AUDITORIA.md) | Auditoria funcional, de segurança e de UX/mobile |
| [handoff.md](docs/handoff.md) | Histórico de entregas e decisões arquiteturais |
| [home_dynamic_architecture.md](docs/home_dynamic_architecture.md) | Arquitetura da Home dinâmica |
| [home_composer_architecture.md](docs/home_composer_architecture.md) | Composição de blocos da Home |
| [home_art_direction.md](docs/home_art_direction.md) | Direção de arte e identidade visual |

Para quem for trabalhar no código com o Claude Code, veja também o [`CLAUDE.md`](CLAUDE.md) na raiz — mapeia a arquitetura e as regras de negócio essenciais.

## 🤝 Contribuindo

Issues e pull requests são bem-vindos. Antes de abrir um PR grande, abra uma issue descrevendo a mudança proposta.

## 📄 Licença

Distribuído sob a licença [MIT](LICENSE).
