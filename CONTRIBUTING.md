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

## Phantom dependencies (pnpm + ESM)

Some upstream packages **import** modules they only list as `peerDependencies` (or dynamic-import without declaring them). pnpm’s strict layout does not hoist those into the consumer’s resolver path → `ERR_MODULE_NOT_FOUND` at runtime (API crash / 504 on proxied auth, or 500 on `*-web` dev servers).

We pin them explicitly until upstream fixes declarations. After bumping **better-auth**, **Nitro**, or **@tanstack/react-start**, grep their `dist/**/*.mjs` for bare `import` / `import()` specifiers not in that package’s `dependencies`, and adjust pins.

| Package                    | Pinned in           | Imported by                                                                            | Remove on upgrade when…                                                              |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `@opentelemetry/api@1.9.1` | `apps/api`          | `@better-auth/core` → `dist/instrumentation/tracer.mjs` (peer `^1.9.0`, static import) | `@better-auth/core` lists it in `dependencies`, or API boots without the pin         |
| `jose@6.2.3`               | `apps/api`          | `@better-auth/core` JWT helpers (peer `^6.1.0`, static import)                         | peer becomes a regular `dependency` of core, or API auth routes work without the pin |
| `kysely@^0.28.14`          | `apps/api`          | `better-auth` / `@better-auth/kysely-adapter` (peer `^0.28.5`, static import)          | adapter stops importing kysely at runtime, or Drizzle-only path needs no pin         |
| `youch@4.1.1`              | root `package.json` | **Nitro `3.0.260429-beta`** → dynamic `import('youch')` for dev error HTML             | Nitro declares `youch` as a runtime `dependency`                                     |
| `youch-core@0.3.3`         | root `package.json` | Nitro → dynamic `import('youch-core')` (transitive of youch)                           | same as `youch`                                                                      |

`@opentelemetry/semantic-conventions` is imported by `@better-auth/core` but declared in its own `dependencies` — no consumer pin needed. `@tanstack/react-start` has no extra phantom imports beyond its declared deps (`pathe`, `react`, etc.).

## Commit messages

Conventional commits in English: `feat(scope): summary`, `fix(scope): …`, `chore(dx): …`, etc.
