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

6. Verify connectivity:

   ```bash
   docker exec mr-reklamacije-postgres psql -U mr -d mr_reklamacije -c "\dx"
   ```

   You should see at least: `citext`, `pg_trgm`, `pgcrypto`, `plpgsql`, `uuid-ossp`.

## Daily workflow

Three terminals (or two if API already running):

```bash
docker compose up -d postgres
pnpm --filter api dev    # :3000
pnpm dev                 # :3001 admin, :3002 internal, :3003 portal
```

- Stop database: `docker compose down` (data persists in volume)
- Reset database: `docker compose down -v` (**deletes all data** in the named volume)
- Before commit: see **`CONTRIBUTING.md`** (`format:write`, `typecheck`, `test`, `lint`, `depcruise`, `format:check`)

## Troubleshooting

**Port 5433 already in use:**

Edit `docker-compose.yml`, change `5433:5432` to something else like `5434:5432`, and update `DATABASE_URL` in `apps/api/.env` accordingly.

**Vite says port 3002 (or 3001/3003) is in use:**

Another dev server is still running. Find and stop it (`lsof -i :3002`) — ports are fixed (`strictPort: true`); Vite will not silently move internal-web to 3004.

**Extensions not installed after first run:**

Init scripts under `scripts/db-init/` run only on **first** volume creation. If something went wrong, recreate the volume:

```bash
docker compose down -v
docker compose up -d postgres
```

**Docker API `ERR_MODULE_NOT_FOUND` (e.g. zod):**

Do not use the Compose API service for daily dev. Run `pnpm --filter api dev` on the host. If you need the container for smoke tests, rebuild: `docker compose --profile prod-like build api`.
