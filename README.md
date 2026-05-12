# MR Reklamacije

Internal warranty claims management application for MR Engines (Serbia).
Handles EMOTIVE (international partners) and DOMACE (domestic market) warranty claims,
with complete statistics, Excel import/export, file attachments, and multi-language client portal.

## Stack

- **Frontend:** TanStack Start v1 (React 19, Vite, SSR)
- **Backend:** Hono (Node.js)
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Better-Auth with custom RBAC layer
- **Real-time:** Server-Sent Events (SSE)
- **Storage:** Railway Volumes (files), Cloudflare R2 migration path ready
- **Hosting:** Railway (monorepo with 5 services)
- **Edge:** Cloudflare (WAF, DDoS, geo-blocking)
- **i18n:** Paraglide (Serbian + English)
- **Excel:** ExcelJS
- **Translation:** OpenAI API
- **Tests:** Vitest (unit/integration) + Playwright (E2E)

## Architecture overview

Three physically isolated SPAs + single API:

```
admin.mrengines.rs          → admin-web service (admin panel only)
interno.mrengines.rs        → internal-web service (employees + viewers)
reklamacije.mrengines.rs    → portal-web service (clients)
api.mrengines.rs            → api service (Hono, behind private network)
```

See `docs/01-architecture.md` for full details.

## Documentation index

1. [`docs/01-architecture.md`](docs/01-architecture.md) — Infrastructure, services, security model
2. [`docs/02-data-model.md`](docs/02-data-model.md) — ERD, tables, relations, indexes
3. [`docs/03-permissions.md`](docs/03-permissions.md) — RBAC system, permissions catalog, system roles
4. [`docs/04-modules.md`](docs/04-modules.md) — Module structure for API and each web app
5. [`docs/05-auth-realtime.md`](docs/05-auth-realtime.md) — Better-Auth config, SSE event system
6. [`docs/06-excel-flow.md`](docs/06-excel-flow.md) — ETL import + export, field mapping
7. [`docs/07-translation.md`](docs/07-translation.md) — OpenAI integration, caching
8. [`docs/08-file-storage.md`](docs/08-file-storage.md) — Volumes, upload rules, limits
9. [`docs/09-ui-ux.md`](docs/09-ui-ux.md) — Design tokens, layouts, shadcn usage
10. [`docs/10-testing.md`](docs/10-testing.md) — Test strategy, coverage requirements
11. [`docs/11-deployment.md`](docs/11-deployment.md) — Railway setup, env vars, CI/CD
12. [`docs/12-roadmap.md`](docs/12-roadmap.md) — Implementation phases for Cursor

## Cursor rules

See `.cursor/rules/` for the complete set of `.mdc` files that Cursor must follow.
**Read all of them before writing any code.**

## Local Development

### Quick start

1. **Install dependencies:**

```bash
pnpm install
```

2. **Start backend (Postgres + API) in background:**

```bash
docker compose up -d
```

3. **Database migrations & seed** (uses `DATABASE_URL` in `apps/api/.env`; run after Postgres is reachable, whenever the schema is new or after `docker compose down -v`):

```bash
pnpm --filter @mr/db run db:migrate
pnpm --filter @mr/db run db:seed
```

4. **Start all frontends in parallel:**

```bash
pnpm dev
```

Or compose backend + parallel frontends in one step (migrate/seed not included):

```bash
pnpm dev:all
```

### Service URLs

| Service      | URL                                                          |
| ------------ | ------------------------------------------------------------ |
| admin-web    | http://localhost:3001                                        |
| internal-web | http://localhost:3002                                        |
| portal-web   | http://localhost:3003                                        |
| API          | http://localhost:3000                                        |
| Postgres     | localhost:5433 (`mr` / `mr_dev_password` / `mr_reklamacije`) |

### Admin login

- Email: `screenfun99@gmail.com`
- Password: `MrAdmin2026!Pass`

### Stop everything

- `Ctrl+C` in `pnpm dev` terminal (stops frontends)
- `docker compose down` (stops Postgres + API)

### Common operations

- **API logs:** `docker compose logs -f api`
- **Postgres shell:** `docker exec -it mr-reklamacije-postgres psql -U mr -d mr_reklamacije`
- **Rebuild API after dependency change:** `docker compose up -d --build api`
- **Reset DB (DANGER — deletes all data):** `docker compose down -v && docker compose up -d`

## Language conventions

- **Technical documentation:** English
- **Code comments:** Serbian or English (developer choice)
- **UI text / labels / error messages:** Serbian (with English translations via Paraglide)
- **Git commit messages:** English, conventional commits (feat/fix/chore/...)
- **Database identifiers:** English snake_case
- **Domain terminology preserved from Excel:** EMOTIVE, DOMACE, UKUPNO, MR NUMBER, APPROVED GREEN — keep exactly as-is
