# Local Development Setup

This document covers the **local machine**: Docker Compose Postgres, env files, and day-to-day commands. For Railway (staging/production), DNS, backups, and production env vars, see **`docs/11-deployment.md`**.

## Prerequisites

- Node.js 20.x (use nvm: `nvm use` from repo root)
- pnpm 9.x (`npm install -g pnpm@9.15.9`)
- Docker Desktop (for local Postgres only in daily dev)

## First-time setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/screenfun012/mr-reklamacije.git
   cd mr-reklamacije
   pnpm install
   ```

   `pnpm install` enables Husky pre-commit hooks (Prettier on staged files).

2. Start the local Postgres:

   ```bash
   docker compose up -d postgres
   ```

3. Wait for Postgres to become healthy:

   ```bash
   docker compose ps
   ```

   The `STATUS` column should show `healthy`.

4. Copy env files (at minimum `apps/api/.env` from `apps/api/.env.example`).

5. Run migrations and seed:

   ```bash
   pnpm --filter @mr/db run db:migrate
   pnpm --filter @mr/db run db:seed
   ```

6. Create the dev admin user:

   ```bash
   pnpm create-admin
   ```

7. Verify connectivity:

   ```bash
   docker exec mr-reklamacije-postgres psql -U mr -d mr_reklamacije -c "\dx"
   ```

   You should see at least: `citext`, `pg_trgm`, `pgcrypto`, `plpgsql`, `uuid-ossp`.

8. **Integration test database** (optional on first setup — auto-created by `pnpm test:integration` if missing):

   ```bash
   psql postgresql://mr:mr_dev_password@localhost:5433/postgres -v ON_ERROR_STOP=1 \
     -f scripts/db-init/02-test-database.sql
   psql postgresql://mr:mr_dev_password@localhost:5433/mr_reklamacije_test \
     -v ON_ERROR_STOP=1 -f scripts/db-init/01-extensions.sql
   ```

   New Docker volumes get `mr_reklamacije_test` from `scripts/db-init/02-test-database.sql` automatically.

## Dev database vs integration test database

| | Dev | Integration tests |
|---|---|---|
| Database | `mr_reklamacije` | `mr_reklamacije_test` |
| Env var | `DATABASE_URL` in `apps/api/.env` | `TEST_DATABASE_URL` (see `.env.example`) |
| Used by | API, migrate, seed, Excel import, browser | `pnpm test:integration` only |
| Safe to TRUNCATE | **No** — real dev data | Yes — tests reset freely |

Integration tests call `assertIntegrationDatabase()` at startup. If the URL is not a `*_test` database (or is `mr_reklamacije`), the run **fails immediately** — dev data cannot be wiped by accident.

- Unit tests: `pnpm test` (no Postgres required for most packages)
- Integration tests: `pnpm test:integration` (migrate + seed test DB once per run, then transactional rollback per API test)

## Daily workflow

**Recommended — one terminal:**

```bash
pnpm dev:all             # Postgres + API :3000 + admin :3001 + internal :3002 + portal :3003
```

Health check anytime:

```bash
pnpm dev:check
```

**Manual — three terminals** (if you prefer separate logs):

```bash
pnpm dev:db              # Postgres; also stops Docker API if it stole :3000
pnpm dev:api             # :3000 — frees port, then host API with hot reload
pnpm dev                 # :3001 admin, :3002 internal, :3003 portal
```

**Important:** Run dev servers in your own terminal (not Cursor background agents). Cursor should only run short-lived checks (`pnpm dev:check`, tests). See `CONTRIBUTING.md`.

### API hot reload vs shared packages

`pnpm dev:api` runs `tsx watch` with `packages/**` excluded from the watch graph. That means:

- Edits under **`apps/api/src`** still restart the API automatically.
- Edits under **`packages/shared`**, **`packages/auth`**, or other workspace packages **do not** restart the API. Press **Enter** in the API terminal (or restart `pnpm dev:api`) after changing shared code so the running process picks up the new modules.

Vite dev servers proxy `/api/**` to `127.0.0.1:3000` with short connection retries during API restarts (GET/HEAD only on `ECONNRESET`; all methods on `ECONNREFUSED`).

- Stop database: `docker compose down` (data persists in volume)
- Reset database: `docker compose down -v` (**deletes all data** in the named volume)
- Before commit: see **`CONTRIBUTING.md`** (`format:write`, `typecheck`, `test`, `lint`, `depcruise`, `format:check`)

## Troubleshooting

**Port 5433 already in use:**

Edit `docker-compose.yml`, change `5433:5432` to something else like `5434:5432`, and update `DATABASE_URL` in `apps/api/.env` accordingly.

**504 on `/api/*` while saving files (brief flicker, then 200):**

During API hot reload the Vite proxy may hit a ~1s gap. Connection retries absorb most of this; if a request still fails, retry the action or wait for the API terminal to show “Server listening”. For persistent 504, run `pnpm dev:check` and restart with `pnpm dev:all`.

**504 on `/api/auth/*`, connection refused on :3002, login flicker:**

The API or a Vite dev server died underneath. Run `pnpm dev:check`, then restart with `pnpm dev:all` (auto-frees ports `3000–3003` and waits for API before frontends).

**Vite says port 3002 (or 3001/3003) is in use:**

Another dev server is still running. `pnpm dev:all` frees ports automatically; or manually: `lsof -nP -iTCP:3002 -sTCP:LISTEN` then `kill -9 <pid>`. Ports are fixed (`strictPort: true`); Vite will not silently move internal-web to 3004.

**`ERR_MODULE_NOT_FOUND` for `nf3/db` or directories like `nf3 2/` in node_modules:**

Interrupted `pnpm install` left a corrupted tree. In your terminal (outside Cursor if EPERM):

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

**Extensions not installed after first run:**

Init scripts under `scripts/db-init/` run only on **first** volume creation. If something went wrong, recreate the volume:

```bash
docker compose down -v
docker compose up -d postgres
```

**All frontends return 500 / `ERR_MODULE_NOT_FOUND: Cannot find package 'youch'`:**

Nitro `3.0.260429-beta` (TanStack Start) imports `youch` and `youch-core` in dev error pages (`dist/_dev.mjs`) but lists them only in Nitro’s own `devDependencies`, not `dependencies`. With pnpm strict `node_modules`, the packages are not hoisted to where Nitro resolves them.

**Workaround (repo root):** explicit `youch@4.1.1` and `youch-core@0.3.3` in root `devDependencies` (versions match Nitro’s devDeps). After upgrading Nitro, check whether they can be removed — see `CONTRIBUTING.md`.

If 500 persists after `pnpm install`, restart all three Vite dev servers (`pnpm dev`).

**Docker API `ERR_MODULE_NOT_FOUND` (e.g. zod) or login always fails:**

The Compose API service is not for daily dev. Stop it and use the host API:

```bash
docker stop mr-reklamacije-api
pnpm dev:api
```

`pnpm dev:api` frees port 3000, stops the Docker API container if running, then starts `pnpm --filter api dev`. For smoke tests only: `docker compose --profile prod-like build api`.

**Login `RATE_LIMITED` (429):**

In development the login limit is relaxed (100/min). If you still hit it from an old API process, restart with `pnpm dev:api`. The login form shows a clear message instead of a generic error.

**`Neispravan e-mail ili lozinka` on first login:**

Run `pnpm create-admin` after migrate + seed on a fresh database.

**Protected pages visible before login on first load (SSR flash):**

Fixed by SSR session check in `requireRoles` + `createServerSessionLoader`. Each web app uses `internalRequireRoles` / `adminRequireRoles` / `portalRequireRoles` from `src/lib/auth-guard.ts`. Restart dev servers after pulling auth changes.

**Intake document never seals / 39 integration tests fail after a pull:**

`playwright` is a dependency of `apps/api` (claim report, intake work order, handover sheet). It
pins a browser revision, and `pnpm install` does **not** download it — so a pull that bumps
Playwright leaves the old build on disk and every render dies:

```bash
cd apps/api && pnpm exec playwright install chromium
```

Recognise it two ways, because the same gap shows up very differently:

- `pnpm test:integration` fails 39 tests across the five `intake-document*` / `intake-handover`
  suites. Twelve of them burn a **20 s** timeout each (`waitForSealedDocument` polls the database
  for a render that can never finish), so the run looks *hung* rather than failed, and the real
  cause — `browserType.launch: Executable doesn't exist at .../chromium_headless_shell-<n>` — is
  buried far below.
- In the running app it is **silent**: sealing is fire-and-forget (`void
  produceDocumentInBackground(id)`), so signing an intake order just leaves the screen saying the
  document is being prepared, forever.

**First `pnpm dev:all` after a pull looks dead for ~10 s:**

Two transients overlap, both self-healing. The Paraglide compile runs immediately before the API
starts, and its filesystem events land *after* `tsx watch` attaches, so the API restarts ~4×
(`[tsx] unlink in .../paraglide/messages/... Restarting...`). At the same time Vite logs
`Re-optimizing dependencies because lockfile has changed` and drops its client entry
(`Failed to fetch dynamically imported module: virtual:tanstack-start-client-entry`). Wait for the
API line `Server listening`, then hard-refresh (Cmd+Shift+R). A clean boot is ~6 s.
