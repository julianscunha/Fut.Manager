# Contribuindo com o Fut.Manager

Obrigado pelo interesse! Este é um projeto white-label — o código é genérico, cada instalação define seu próprio `APP_NAME`. Ao contribuir, mantenha essa premissa: nunca hardcode o nome de um grupo específico.

## Antes de começar

- Leia o [`CLAUDE.md`](CLAUDE.md) — mapeia a arquitetura, o modelo de domínio e as convenções do projeto.
- Para mudanças grandes, abra uma [issue](https://github.com/julianscunha/Fut.Manager/issues) descrevendo a proposta antes de codar.
- Para bugs, abra uma issue com passos de reprodução.

## Setup local

```bash
npm install
cp .env.example .env.local   # configure APP_NAME, Supabase, JWT_SECRET
npm run dev
```

Veja o [README](README.md#-começando) para pré-requisitos completos.

## Fazendo uma alteração

1. Crie um branch a partir de `main`: `git checkout -b minha-mudanca`.
2. Rode `npm run lint` (type-check) antes de abrir o PR — não há suíte de testes automatizada, então teste manualmente o fluxo que você tocou.
3. Siga o padrão de commits do histórico (mensagens curtas, no imperativo, prefixo tipo `fix:`/`feat:`/`docs:` quando fizer sentido).
4. Abra o PR descrevendo o quê e o porquê da mudança.

## Diretrizes de código

- TypeScript em todo lugar; tipos de domínio compartilhados vivem em `src/types/domain.ts` e `src/types/ui.ts` — não duplique tipos.
- Chamadas ao backend no frontend sempre via `authFetch` (`src/lib/authFetch.ts`), nunca `fetch` puro.
- Campo novo em tipo persistido? Precisa do `ALTER TABLE`/`CREATE TABLE` correspondente no Supabase — ver `openwiki/operations/deploy-guide.md`.
- Sem linter de estilo configurado; siga a formatação já presente no arquivo que você está editando.

## Dúvidas

Abra uma [issue](https://github.com/julianscunha/Fut.Manager/issues) com a tag `question`.
