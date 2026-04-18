# Local Development Setup

This document covers the **local machine**: Docker Compose Postgres, env files, and day-to-day commands. For Railway (staging/production), DNS, backups, and production env vars, see **`docs/11-deployment.md`**.

## Prerequisites

- Node.js 20.x (use nvm: `nvm use` from repo root)
- pnpm 9.x (`npm install -g pnpm@9.15.9`)
- Docker Desktop (for local Postgres)

## First-time setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/screenfun012/mr-reklamacije.git
   cd mr-reklamacije
   pnpm install
   ```

2. Start the local Postgres:

   ```bash
   docker compose up -d
   ```

3. Wait for Postgres to become healthy:

   ```bash
   docker compose ps
   ```

   The `STATUS` column should show `healthy`.

4. Copy the example env file:

   ```bash
   cp .env.example .env
   ```

5. Verify connectivity:

   ```bash
   docker exec mr-reklamacije-postgres psql -U mr -d mr_reklamacije -c "\dx"
   ```

   You should see at least: `citext`, `pg_trgm`, `pgcrypto`, `plpgsql`, `uuid-ossp`.

## Daily workflow

- Start database: `docker compose up -d`
- Stop database: `docker compose down` (data persists in volume)
- Reset database: `docker compose down -v` (**deletes all data** in the named volume)
- Run tests: `pnpm -r test`
- Build everything: `pnpm build`
- Lint everything: `pnpm lint`

## Troubleshooting

**Port 5433 already in use:**

Edit `docker-compose.yml`, change `5433:5432` to something else like `5434:5432`, and update `DATABASE_URL` in `.env` accordingly.

**Extensions not installed after first run:**

Init scripts under `scripts/db-init/` run only on **first** volume creation. If something went wrong, recreate the volume:

```bash
docker compose down -v
docker compose up -d
```
