# 11 — Deployment and Operations

This document focuses on **Railway** (staging/production), DNS, backups, and production operations. For Docker Compose on your laptop, Postgres extensions, and local env setup, see **`docs/DEV_SETUP.md`**.

## Hosting: Railway

One project, multiple environments, multiple services per environment.

### Project setup

1. Create Railway project: `mr-reklamacije`
2. Upgrade to **Pro plan** ($20/mo team) — required for volumes, multi-env, higher resources
3. Create two environments: `production` and `staging`
4. Connect GitHub repo to the project

### Services (per environment)

Each environment contains these 5 services, all defined in one repo:

| Service | Root dir | Build | Start | Port |
|---|---|---|---|---|
| `postgres` | — | Railway managed | — | 5432 (internal) |
| `api` | `apps/api` | `pnpm install --frozen-lockfile && pnpm --filter api build` | `pnpm --filter api start` | 3000 |
| `admin-web` | `apps/admin-web` | `pnpm install --frozen-lockfile && pnpm --filter admin-web build` | `pnpm --filter admin-web start` | 3000 |
| `internal-web` | `apps/internal-web` | same pattern | same pattern | 3000 |
| `portal-web` | `apps/portal-web` | same pattern | same pattern | 3000 |

### Web app ↔ API routing (dev vs production)

In **local development**, each TanStack Start app (`*-web`) uses a small Vite plugin in `vite.config.ts` (`mr-api-proxy`, built on `http-proxy-middleware`) that forwards **`/api/**`** to **`apps/api`** (e.g. `http://localhost:3000`). That plugin runs only in `pnpm dev`; it is **not** part of the Nitro production bundle. It exists mainly so the browser can call same-origin `/api/...` (including Better-Auth with multiple `Set-Cookie` headers during 2FA) while the API runs as a separate process.

In **production** (Railway `pnpm start` / Nitro), the same **`/api/**`** path must be **routed at the edge or load balancer** to the **`api`** service — e.g. Cloudflare, nginx, or Caddy in front of the web service, or Railway private networking between services. Do not rely on Vite dev middleware in production.

### Monorepo configuration

Each web service has a `railway.json` in its app dir:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd ../.. && pnpm install --frozen-lockfile && pnpm --filter api build"
  },
  "deploy": {
    "startCommand": "pnpm --filter api start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

The root directory for each service in Railway UI is set to its `apps/<name>`
folder. Nixpacks uses pnpm workspaces correctly when invoked from repo root.

### Volume (for api service only)

- Mount path: `/data`
- Size: **10 GB** (upgradable)
- Attached only to `api` service
- Not attached to web services (they don't need it)

### Auto-deploy

- `production` env watches `main` branch
- `staging` env watches `develop` branch
- Every push triggers build + deploy for changed services (Nixpacks detects paths)
- Turbo cache is used to skip builds for unchanged services

### PR environments

Railway can spin up a full environment per PR automatically. Enable this for `develop` branch PRs.
Each PR gets its own DB, volumes, and subdomains (`pr-42.railway.app` etc.).
Auto-destroyed on merge/close.

### Rollback

- Railway keeps deploy history
- Any service can be rolled back to a prior deployment via UI (one click)
- Database migrations are forward-only; if a migration is bad, we write a new migration to revert it (never rollback DB)

---

## Domains and DNS

### DNS provider

Cloudflare manages DNS for `mrengines.rs` (domain registration can be anywhere).

### Records

For **production**:

| Subdomain | Type | Target | Proxy |
|---|---|---|---|
| `admin.mrengines.rs` | CNAME | admin-web.railway.app | ☁️ Proxied |
| `interno.mrengines.rs` | CNAME | internal-web.railway.app | ☁️ Proxied |
| `reklamacije.mrengines.rs` | CNAME | portal-web.railway.app | ☁️ Proxied |
| `api.mrengines.rs` | CNAME | api.railway.app | ☁️ Proxied |

For **staging**:

| Subdomain | Type | Target | Proxy |
|---|---|---|---|
| `admin-staging.mrengines.rs` | CNAME | ... | ☁️ Proxied |
| `interno-staging.mrengines.rs` | CNAME | ... | ☁️ Proxied |
| `reklamacije-staging.mrengines.rs` | CNAME | ... | ☁️ Proxied |
| `api-staging.mrengines.rs` | CNAME | ... | ☁️ Proxied |

### TLS

- Cloudflare: **Full (strict)** mode
- Railway: automatic Let's Encrypt for each service domain
- No manual cert management

---

## Environment variables

### Common (all services)

```
NODE_ENV=production | staging
LOG_LEVEL=info | debug
TZ=Europe/Belgrade
```

### `api` service

```
# Server
PORT=3000
HOST=0.0.0.0
API_BASE_URL=https://api.mrengines.rs
PUBLIC_ORIGINS=https://admin.mrengines.rs,https://interno.mrengines.rs,https://reklamacije.mrengines.rs

# Database
DATABASE_URL=${{postgres.DATABASE_URL}}

# Auth
BETTER_AUTH_SECRET=<random 64-char string>
BETTER_AUTH_URL=https://api.mrengines.rs

# Session durations (minutes)
SESSION_IDLE_ADMIN_MIN=30
SESSION_IDLE_OPERATOR_MIN=240
SESSION_IDLE_VIEWER_MIN=240
SESSION_IDLE_CLIENT_MIN=43200      # 30 days

# OpenAI
OPENAI_API_KEY=<from Nikola>
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS_PER_REQUEST=2000

# Storage
UPLOAD_DIR=/data/uploads
MAX_FILE_SIZE_MB=25
MAX_FILES_PER_CLAIM=50
MAX_TOTAL_SIZE_PER_CLAIM_MB=500

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=<secret>
EMAIL_FROM=no-reply@mrengines.rs
EMAIL_FROM_NAME=MR Reklamacije

# Admin seed (only used on first bootstrap)
ADMIN_SEED_EMAIL=nikola@mrengines.rs
ADMIN_SEED_NAME=Nikola
ADMIN_SEED_INITIAL_PASSWORD=<one-time; changed on first login>

# Rate limiting
RATE_LIMIT_EXPORT_PER_MIN=3
RATE_LIMIT_TRANSLATION_PER_HOUR_CLIENT=60
RATE_LIMIT_TRANSLATION_PER_HOUR_INTERNAL=300

# Feature flags
FEATURE_VIRUS_SCAN=false
FEATURE_R2_STORAGE=false
```

### `admin-web`, `internal-web`, `portal-web`

```
PORT=3000
HOST=0.0.0.0

# Public URL (for redirects, SEO, SSR)
PUBLIC_URL=https://admin.mrengines.rs        # or interno.* or reklamacije.*

# Internal API URL (private Railway network)
API_INTERNAL_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3000

# Auth (shared secret for session cookie verification in SSR loader)
BETTER_AUTH_SECRET=${{api.BETTER_AUTH_SECRET}}

# i18n default
DEFAULT_LANGUAGE=sr
```

### Secrets management

- All secrets configured in Railway UI under each service
- `BETTER_AUTH_SECRET` and `OPENAI_API_KEY` shared between services via Railway's `${{service.VAR}}` syntax
- Never committed to git
- `.env.example` in each app shows required vars with placeholder values

---

## Database setup

### Initial migration

On first deploy, the `api` service runs `pnpm db:migrate` as part of its start command:

```json
// apps/api/package.json
{
  "scripts": {
    "start": "pnpm db:migrate && node dist/server.js"
  }
}
```

If a migration fails, the service refuses to start. Visible in Railway logs.

### Seed

On first deploy, if `users` table is empty, run `pnpm db:seed:production`:
- Permissions (seeded from code)
- System roles (admin, operator, viewer, client)
- Departments (10 predefined codes)
- Claim sources (8 predefined)
- Customers (EMOTIVE partner list)
- Engine types (extracted from Excel)
- Initial admin user (from `ADMIN_SEED_*` env vars)

Seed is idempotent — safe to run multiple times.

### Connection pooling

Drizzle uses `pg` with a connection pool. Pool size: 10 (default) per API instance.
Railway Postgres supports ~200 concurrent connections, plenty for our needs.

### Backup

**Daily automated (Railway):**
- Railway Pro includes daily snapshots with 7-day retention
- Accessible via Railway UI, can restore to new service

**Nightly logical dump to Synology (cron on Synology):**
```bash
# /usr/local/etc/cron/mr-reklamacije-db-backup.sh
DATE=$(date +%Y%m%d)
pg_dump "$PRODUCTION_DATABASE_URL" \
  | gzip > /volume1/backups/mr-reklamacije/db/mr-$DATE.sql.gz

# rotation: keep 30 daily, 12 monthly
find /volume1/backups/mr-reklamacije/db -name "mr-*.sql.gz" -mtime +30 -delete
```

Runs at 03:00 Belgrade time via Synology's Task Scheduler.

### Restore procedure

From a Railway snapshot (fastest):
1. Railway UI → Postgres → Backups → Select snapshot → Restore to new service
2. Swap `DATABASE_URL` references to point at new service
3. Restart `api` service

From Synology dump (if Railway is unavailable):
1. Create a new Postgres service on Railway
2. SCP the dump file from NAS
3. `gunzip -c mr-DATE.sql.gz | psql "$NEW_DATABASE_URL"`
4. Update env vars + restart api

**Test restore quarterly.** Document last tested date in admin wiki.

### Migrations discipline

- Migrations live in `packages/db/migrations/`, timestamped and numbered
- `drizzle-kit generate` produces them from schema diff
- Every PR touching schema must include the corresponding migration file
- Migrations are **forward-only**; to revert, write a new migration
- Breaking changes (e.g., dropping a column) must go through: deprecate → stop writing → migrate readers → drop, across multiple releases

---

## Volume backup

### Nightly rsync to Synology

See `docs/08-file-storage.md`. Summary:
- 03:30 Belgrade time
- rsync from Railway volume to NAS
- Retention: 30 daily + 12 monthly via Synology snapshots

### Restore procedure

- Create new volume on Railway (if current is lost)
- rsync from NAS to new volume
- Update volume mount + restart api service
- Run reconciliation job to verify DB ↔ filesystem consistency

---

## CI/CD pipeline

### Branch strategy

- `main` — production; every merge deploys to production
- `develop` — staging; every merge deploys to staging
- Feature branches: `feat/<description>`, `fix/<description>`, `chore/<description>`
- PRs open against `develop`; `develop` → `main` is a scheduled merge

### PR checks (GitHub Actions — see `docs/10-testing.md`)

1. **Lint** — ESLint on all packages
2. **Typecheck** — `tsc --noEmit` on all packages
3. **Unit + integration tests** — Vitest with real Postgres
4. **E2E tests** — Playwright in headless Chrome
5. **Coverage check** — fails if thresholds not met
6. **Build check** — all packages must build

All must pass. No merge allowed with failing checks (enforced via GitHub branch protection).

### Deployment triggers

- Merge to `develop` → Railway auto-deploys affected services to staging
- Merge to `main` → Railway auto-deploys affected services to production
- Turbo only triggers build for services whose files changed; others skip

### Post-deploy checks

After each production deploy, GitHub Action runs smoke tests:
- `GET /api/health` returns 200
- `GET https://admin.mrengines.rs/login` returns 200
- `GET https://interno.mrengines.rs/login` returns 200
- `GET https://reklamacije.mrengines.rs/login` returns 200

If any fail, alert sent to Nikola via email.

### Manual promotion (preferred over auto from main)

For extra safety: PR merge to main triggers deploy to a **"production-preview"** env first.
Nikola clicks "Promote to production" in Railway when ready.

Initial setup: auto-promote enabled. Once we have real client traffic, switch to manual.

---

## Monitoring

### Built-in (Railway)

- CPU, memory, network per service
- Deploy history with build + runtime logs
- Crash reports
- Per-service uptime

### Uptime monitoring (external)

**UptimeRobot** (free tier):
- 5-min checks on `https://api.mrengines.rs/health`
- 5-min checks on each frontend `/login` page
- Email alerts to Nikola

### Logs

- Structured JSON via pino, level `info` in prod, `debug` in staging
- Railway aggregates logs per service; searchable in UI
- Retention: 30 days in Railway; export to NAS weekly for longer retention

### Custom dashboards (admin UI)

The admin panel has a `/admin/diagnostics` page showing:
- Active users count
- Last 24h requests count
- Error rate (from audit_log counts)
- DB size and connection count
- Storage usage (volume fill percent)
- Last successful backup timestamp (read from env or health endpoint)

---

## Health endpoints

Each service exposes `/health`:

```
GET /health
Response: { "status": "ok", "timestamp": "...", "version": "..." }
```

API adds deeper checks:

```
GET /health/detailed  (admin-only, auth required)
{
  "status": "ok",
  "db": { "ok": true, "latencyMs": 3 },
  "storage": { "ok": true, "usedBytes": ..., "totalBytes": ... },
  "openai": { "ok": true, "lastSuccess": "..." },
  "eventBus": { "ok": true, "subscribers": 14 }
}
```

Railway health check uses `/health` (liveness). Detailed only for humans.

---

## Email sending

**Provider:** Resend (simple, EU-hosted)

Transactional emails:
- Welcome (after admin creates user)
- Password reset
- 2FA recovery
- Client registration acknowledgement
- Client registration approval/rejection
- Admin notification: new registration pending

All emails templated with Paraglide; rendered in user's preferred language.

Email sending wrapped in `EmailService` interface — swap to SMTP/SES easily.

### DKIM / SPF / DMARC

Configure Cloudflare DNS:
- SPF: include Resend's domain
- DKIM: Resend-provided CNAME
- DMARC: start with `p=none` for monitoring, tighten later

---

## Incident response

### Severity levels

- **SEV-1** — service down, data loss
- **SEV-2** — major feature broken (can't create claim, login fails)
- **SEV-3** — minor feature broken (chart doesn't render)
- **SEV-4** — cosmetic issue

### On-call

Single-person team (Nikola). Alerts to his email + phone for SEV-1/2.

### Runbook

`docs/runbook.md` (to be written after first incidents) with:
- "API not responding" → steps
- "Database out of disk" → steps
- "Login broken" → steps
- "Export takes forever" → steps

---

## Cost summary

| Item | Monthly |
|---|---|
| Railway Pro plan (team seat) | $20 |
| Railway usage (5 services + DB + volume) | $5–10 |
| Cloudflare (free tier) | $0 |
| Resend (free tier covers 3k emails/month) | $0 |
| OpenAI (~500 translations/month) | $0.03 |
| Domain (yearly, prorated) | ~$2 |
| **Total** | **~$27/month** |

Well within budget. Scales linearly if volume grows.

---

## Disaster recovery

### Total Railway failure (theoretical)

Data is safe on Synology NAS:
- Daily DB dumps
- Nightly volume rsync

To recover on different provider (e.g., DigitalOcean):
- Spin up Postgres
- Restore dump
- Spin up Node runtime for each service
- Mount volume, rsync files back
- Update DNS (Cloudflare)

RTO (recovery time objective): **4 hours** for full DR
RPO (recovery point objective): **24 hours** (last nightly backup)

For MVP, this is acceptable. Upgrade later if business needs it.

---

## Deployment checklist (first production deploy)

- [ ] Railway project created, Pro plan active
- [ ] GitHub repo connected
- [ ] 5 services configured (postgres, api, admin-web, internal-web, portal-web)
- [ ] Volume attached to api service (10 GB)
- [ ] Production environment variables set for each service
- [ ] Cloudflare DNS records pointing at Railway services, proxied
- [ ] Cloudflare WAF rules configured per subdomain (see `docs/01-architecture.md`)
- [ ] DKIM/SPF/DMARC for email configured in Cloudflare DNS
- [ ] Synology cron jobs for DB dump + volume rsync running
- [ ] UptimeRobot monitors for each public URL
- [ ] Initial admin user seeded + password changed
- [ ] Smoke tests passing on production
- [ ] Runbook drafted
- [ ] Team training: how to access Railway, how to rollback, how to read logs

---

## Ongoing operations

### Weekly

- Review audit log for unusual activity
- Check backup completion logs on Synology
- Review Railway resource usage

### Monthly

- Review costs vs. budget
- Review uptime stats
- Dependency updates (`pnpm outdated`; merge non-major updates after CI passes)

### Quarterly

- Test database restore from Synology dump
- Review and rotate BETTER_AUTH_SECRET if policy requires
- Review user list, deactivate dormant accounts
- Review OpenAI usage vs. translation cache hit rate
