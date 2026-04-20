# @mr/api

Hono-based HTTP API for MR Reklamacije.

## Local development

1. Ensure Docker Postgres is running: `docker compose up -d postgres`
2. Copy `.env.example` to `.env` in this directory: `cp .env.example .env`
3. Run dev server: `pnpm --filter api dev`

Server listens on `http://localhost:3000` by default.

## Endpoints (Phase 0)

- `GET /health` — liveness check (for Railway)
- `GET /api/health` — acceptance check (for frontend)

Both return `{ status: 'ok', timestamp: <ISO8601> }`.

## Scripts

- `pnpm --filter api dev` — watch mode with auto-reload
- `pnpm --filter api build` — production build to `dist/`
- `pnpm --filter api start` — run production build
- `pnpm --filter api typecheck` — TypeScript check
- `pnpm --filter api test` — unit tests
- `pnpm --filter api lint` — ESLint

## Environment

Dev mode loads `.env` via `tsx --env-file=.env`. Production gets env
from Railway variables (see `docs/11-deployment.md`).

All env vars are validated at startup via Zod schema in
`src/config/env.ts`. Missing or invalid values cause immediate exit
with detailed error message.
