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

### One command (recommended)

```bash
pnpm dev:all
```

Starts **Postgres → API (:3000) → 3 frontends (:3001–:3003)** in a single terminal with prefixed logs (`api|`, `admin|`, `internal|`, `portal|`). Before start it frees ports `3000–3003`, waits for Postgres healthy, waits for API `get-session` **before** Vite boots (no 504 race), and auto-restarts crashed API/Vite processes.

Preflight / troubleshooting:

```bash
pnpm dev:check          # Postgres, API, ports, node_modules, phantom pins
pnpm dev:audit-deps     # Scan better-auth / nitro for new phantom imports
```

After a fresh DB: `pnpm --filter @mr/db run db:migrate && pnpm --filter @mr/db run db:seed && pnpm create-admin`

### Manual (three terminals)

Only if you prefer separate logs:

```bash
pnpm dev:db              # Postgres + stops stray Docker API on :3000
pnpm dev:api             # terminal 1 — frees :3000, starts host API
pnpm dev                 # terminal 2 — admin :3001, internal :3002, portal :3003
```

### Rules (stability)

1. **Dev servers live in Nikola’s terminal** — run `pnpm dev:all` (or manual trio) in iTerm/Terminal.app. **Cursor agents must not start or kill long-running dev servers.** If an agent needs to verify something, it uses a one-off command that exits (e.g. `pnpm dev:check`, unit tests) and does not touch Nikola’s `dev:all` session.
2. **Never interrupt `pnpm install`** — a partial install corrupts `node_modules` (e.g. `nf3 2/` duplicate dirs, missing `package.json`). If install fails with EPERM on `.claude/settings.local.json`, run `pnpm install` **manually outside Cursor** (sandbox cannot unlink those files).
3. **504 / connection refused / login flicker** almost always means API or Vite died underneath — run `pnpm dev:check`, then `pnpm dev:all`. The app code is usually fine; the environment is not.
4. Do **not** use `docker compose up -d api` for daily dev — Compose API is for prod-like smoke tests only (`--profile prod-like`).

See `README.md` and `docs/DEV_SETUP.md` for first-time setup, migrations, and troubleshooting.

## Phantom dependencies (pnpm + ESM)

Some upstream packages **import** modules they only list as `peerDependencies` (or dynamic-import without declaring them). pnpm’s strict layout does not hoist those into the consumer’s resolver path → `ERR_MODULE_NOT_FOUND` at runtime (API crash / 504 on proxied auth, or 500 on `*-web` dev servers).

We pin them explicitly until upstream fixes declarations. After bumping **better-auth**, **Nitro**, or **@tanstack/react-start**, run:

```bash
pnpm dev:audit-deps
```

This scans their `dist/**/*.mjs` for bare `import` / `import()` specifiers not declared in that package’s `dependencies` / `peerDependencies`, and reports MISSING vs PINNED.

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
