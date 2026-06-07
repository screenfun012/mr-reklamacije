# Contributing

## Before you commit

Run the full local verification suite (matches CI):

```bash
pnpm format:write
pnpm typecheck
pnpm test
pnpm lint
pnpm --filter api depcruise
pnpm format:check   # must exit 0 — confirms nothing was missed
```

Staged files are auto-formatted on commit via **lint-staged** + Prettier (see `.husky/pre-commit`). If the hook reformats files, stage the changes and commit again.

## Local development (standard)

Postgres in Docker; API and frontends on the host:

```bash
pnpm dev:db              # Postgres + stops stray Docker API on :3000
pnpm dev:api             # terminal 1 — frees :3000, starts host API
pnpm dev                 # terminal 2 — admin :3001, internal :3002, portal :3003
```

After a fresh DB: `pnpm --filter @mr/db run db:migrate && pnpm --filter @mr/db run db:seed && pnpm create-admin`

Do **not** use `docker compose up -d api` for daily dev — the Compose API image is for production-like smoke tests only (`--profile prod-like`). Rebuild after dependency changes: `docker compose --profile prod-like build api`.

See `README.md` and `docs/DEV_SETUP.md` for first-time setup, migrations, and troubleshooting.

## Commit messages

Conventional commits in English: `feat(scope): summary`, `fix(scope): …`, `chore(dx): …`, etc.
