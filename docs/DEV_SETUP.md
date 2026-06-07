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

- Stop database: `docker compose down` (data persists in volume)
- Reset database: `docker compose down -v` (**deletes all data** in the named volume)
- Before commit: see **`CONTRIBUTING.md`** (`format:write`, `typecheck`, `test`, `lint`, `depcruise`, `format:check`)

## Troubleshooting

**Port 5433 already in use:**

Edit `docker-compose.yml`, change `5433:5432` to something else like `5434:5432`, and update `DATABASE_URL` in `apps/api/.env` accordingly.

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
