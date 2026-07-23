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

| Service | Config file | Build | Start | Port |
|---|---|---|---|---|
| `postgres` | — | Railway managed | — | 5432 (internal) |
| `api` | `apps/api/railway.json` | Dockerfile (`apps/api/Dockerfile`) | image CMD (`pnpm --filter api start`) | 3000 |
| `admin-web` | `apps/admin-web/railway.json` | Nixpacks + `turbo run build --filter=admin-web` | `pnpm --filter admin-web start` | 3000 |
| `internal-web` | `apps/internal-web/railway.json` | same pattern | same pattern | 3000 |
| `portal-web` | `apps/portal-web/railway.json` | same pattern | same pattern | 3000 |

All four services keep the **root directory at the repo root** (shared pnpm monorepo — packages are needed at build time); each service points to its own config file via **Settings → Config-as-code file path** (the path is absolute from the repo root and does not follow the root-directory setting). The `api` service additionally runs migrations before every deploy via `preDeployCommand: pnpm --filter @mr/db run db:migrate:deploy` — it installs the required Postgres extensions (`uuid-ossp`, `pgcrypto`, `citext`, `pg_trgm` — needed *before* migration `0000`, so they can never live in a migration file) and then applies all pending migrations. Idempotent, proven migrate-from-zero.

### Web app ↔ API routing (dev vs production)

In **local development**, each TanStack Start app (`*-web`) uses a small Vite plugin in `vite.config.ts` (`mr-api-proxy`, built on `http-proxy-middleware`) that forwards **`/api/**`** to **`apps/api`** (e.g. `http://localhost:3000`). That plugin runs only in `pnpm dev`; it is **not** part of the Nitro production bundle. It exists mainly so the browser can call same-origin `/api/...` (including Better-Auth with multiple `Set-Cookie` headers during 2FA) while the API runs as a separate process.

In **production** (Railway `pnpm start` / Nitro), each app ships a catch-all **`/api/$` server route** that streams `/api/**` to the API over Railway's **private network** (`proxyApiRequest` from `@mr/shared`, target from `API_INTERNAL_URL`). The browser always talks same-origin; no edge routing rules and no browser CORS are needed, and the API service does not need a public domain at all. In dev the Vite `mr-api-proxy` middleware intercepts first, so dev behavior is unchanged.

### Monorepo configuration

The real configs are checked in — one `railway.json` per app dir (`apps/api`, `apps/admin-web`, `apps/internal-web`, `apps/portal-web`). Web apps build with Nixpacks (`pnpm exec turbo run build --filter=<app>`, health check on `/login`); the api builds from `apps/api/Dockerfile` (production image: workspace build + Playwright Chromium, `CMD pnpm --filter api start`; docker-compose's `prod-like` profile overrides the command back to dev watch). Health check for the api is `/health`.

### Volume (for api service only)

- Mount path: `/data`
- Size: **10 GB** (upgradable)
- Attached only to `api` service
- Not attached to web services (they don't need it)

### Claim report PDF export (Playwright)

Server-side PDF uses Playwright + Chromium on the **`api`** service only.

| Requirement | Value |
|---|---|
| Env flag | `CLAIM_REPORT_PDF_ENABLED=true` (default). Set `false` to return **503** and let internal-web fall back to browser print. |
| RAM | **≥ 1 GB** for the `api` service when PDF export is enabled |
| Docker | After `pnpm install`, run `pnpm --filter api exec playwright install chromium --with-deps` (see `apps/api/Dockerfile`) |
| Rate limit | 5 exports / minute / user |

If staging/production PDF generation fails (missing Chromium, OOM, Railway limits):

1. Set `CLAIM_REPORT_PDF_ENABLED=false` — app keeps working; users get print fallback on read-only report view.
2. Or try a lighter bundle (`@sparticuz/chromium`) in a follow-up.
3. Do **not** block deploy — PDF is optional; Word export and the rest of the app must keep running.

Word export uses `@turbodocx/html-to-docx` with **embedded base64 images** (hydrated from storage on the server, never fetched via attachment URLs).

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

Cloudflare manages DNS for `mrclaims.live` (domain registration can be anywhere).

### Records

For **production**:

| Subdomain | Type | Target | Proxy |
|---|---|---|---|
| `admin.mrclaims.live` | CNAME | admin-web.railway.app | ☁️ Proxied |
| `internal.mrclaims.live` | CNAME | internal-web.railway.app | ☁️ Proxied |
| `mrclaims.live` (apex — the client portal has NO subdomain) | CNAME | portal-web.railway.app | ☁️ Proxied |

No public record for the api — the web apps reach it over Railway's private network (`API_INTERNAL_URL`), and the browser only ever calls same-origin `/api/...`.

**Disable the default `*.up.railway.app` domains** on all three web services once the Cloudflare domains work. This is not cosmetic: the api derives the client IP for rate limiting and the audit log from `CF-Connecting-IP` (falling back to the rightmost `X-Forwarded-For` entry — see `apps/api/src/core/http/client-ip.ts`), and Cloudflare only overwrites that header when it is actually in front of every request.

For **staging**:

| Subdomain | Type | Target | Proxy |
|---|---|---|---|
| `admin-staging.mrclaims.live` | CNAME | ... | ☁️ Proxied |
| `internal-staging.mrclaims.live` | CNAME | ... | ☁️ Proxied |
| `staging.mrclaims.live` | CNAME | ... | ☁️ Proxied |

(No staging environment exists yet — this is the shape it would take.)

### TLS

- Cloudflare: **Full (strict)** mode
- Railway: automatic Let's Encrypt for each service domain
- No manual cert management

---

## Environment variables

The source of truth for what the API reads is `apps/api/src/config/env.ts` (Zod schema); `apps/api/.env.example` shows the dev shape. This list matches that schema. (File-size caps live in `@mr/shared/constants/limits.ts`; rate-limit numbers live in `apps/api/src/core/middleware/rate-limit.ts` — neither is env-configurable.) `OPENAI_API_KEY`, `RESEND_API_KEY`/`RESEND_FROM_EMAIL` and `ATTACHMENT_SIGNING_SECRET` are **optional in the schema** — the api boots without them, but translation is unavailable, activation emails silently no-op, and attachment signing falls back to `BETTER_AUTH_SECRET`. For production treat all four as required.

### `api` service

```
# Server
NODE_ENV=production
LOG_LEVEL=info
TZ=Europe/Belgrade
PORT=3000
HOST=::                        # Railway private networking is IPv6 — 0.0.0.0 would be unreachable for the web apps
API_BASE_URL=https://internal.mrclaims.live   # only used to build browser-facing signed attachment URLs → must be a public origin (the proxy carries /api/* to the api)
PUBLIC_ORIGINS=https://admin.mrclaims.live,https://internal.mrclaims.live,https://mrclaims.live
SELF_SIGNUP_ORIGINS=https://internal.mrclaims.live    # employee self-signup (internal only)
CLIENT_SIGNUP_ORIGINS=https://mrclaims.live

# Database
DATABASE_URL=${{postgres.DATABASE_URL}}

# Auth
BETTER_AUTH_SECRET=<random ≥32 chars>
BETTER_AUTH_URL=https://internal.mrclaims.live   # public https origin so auth cookies get the Secure flag
ATTACHMENT_SIGNING_SECRET=<random ≥32 chars, separate from BETTER_AUTH_SECRET>
PROTECTED_SUPER_ADMIN_EMAIL=screenfun99@gmail.com

# Scaling (optional; default 1)
API_REPLICA_COUNT=1

# Session idle timeouts (minutes)
SESSION_IDLE_ADMIN_MIN=30
SESSION_IDLE_OPERATOR_MIN=240
SESSION_IDLE_VIEWER_MIN=240
SESSION_IDLE_CLIENT_MIN=43200      # 30 days

# OpenAI (translation)
OPENAI_API_KEY=<from Nikola>
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS_PER_REQUEST=2000

# Storage (Railway volume mounted at /data)
UPLOAD_DIR=/data/uploads

# Email (client activation mails)
RESEND_API_KEY=<secret>
RESEND_FROM_EMAIL=no-reply@mrengines.rs

# PDF export (set false if Chromium misbehaves — app falls back to browser print)
CLAIM_REPORT_PDF_ENABLED=true
```

### `admin-web`, `internal-web`, `portal-web`

The web apps read exactly one runtime variable — the proxy target:

```
API_INTERNAL_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3000
```

(`PORT` is injected by Railway and honored by Nitro automatically. `VITE_API_URL` is a dev-only override that takes precedence over `API_INTERNAL_URL` — it must **not** be set on a production web service.)

### Secrets management

- All secrets live **only on the `api` service** (Railway UI) — the web apps hold no secrets, just `API_INTERNAL_URL`
- Never committed to git
- `.env.example` in each app shows the vars with placeholder values

---

## Database setup

### Migrations on deploy

The `api` service's `railway.json` sets `preDeployCommand: pnpm --filter @mr/db run db:migrate:deploy` (`packages/db/src/migrate-deploy.ts`): it installs the required Postgres extensions, then applies all pending migrations. If it fails, the deploy aborts and the previous version keeps running — visible in Railway logs. Idempotent and proven from-zero (empty DB → extensions → all migrations → 31 tables).

### First production deploy (runbook)

1. **Postgres** service created; **api** env vars set (list above); volume mounted at `/data`.
2. **Deploy `api`** — pre-deploy migrates the empty DB automatically. Check `/health`.
3. **System seed** (one-off shell on the api service): `pnpm --filter @mr/db run db:seed` — prod-safe reference data only (permissions, roles, departments, claim sources, engine manufacturers), idempotent. **Never** `db:seed:demo` in production.
4. **First admin** (same one-off shell): `ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_NAME=… pnpm create-admin` — idempotent bootstrap; every later admin is created through the UI. Change the password on first login.
5. **Legacy import** — needs `.legacy-import/legacy-data.json` (kept out of git, so it is never in the image). Put it on the volume first — from the one-off shell: `curl -o /data/legacy-data.json <temporary-signed-URL>` (or paste via `railway ssh`). Then dry-run: `pnpm --filter api import-legacy -- --file /data/legacy-data.json`, review the report, then add `--apply`. Done **together with Nikola** as a supervised one-off on the api service (never from a local machine against prod); delete `/data/legacy-data.json` afterwards.
6. **Deploy the 3 web apps** with `API_INTERNAL_URL` set; health check is `/login`.
7. **DNS (Cloudflare)** — CNAME records for the three web services only; the api stays on the private network with no public domain.
8. **Verify**: login on all three apps, claims list + detail, SSE live update, file upload + thumbnail, PDF export, portal registration → approval → activation email (Resend).

**Adding an env var later:** set it in Railway (api or web service), redeploy that service (env changes don't apply to running deploys), and mirror it in `apps/api/.env.example` + the list above in the same PR.

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

### ⚠️ Restore ORDER: object storage first, database second

The database and the attachment bucket are backed up on **independent schedules**.
Restoring them to two different moments produces claims whose photo rows point at
objects that do not exist in the restored bucket — and it does not fail at restore
time. It surfaces weeks later as "photos are missing from old claims".

Point-in-time recovery makes this **easier to get wrong, not harder**: PITR can put
the database at any second, while the bucket only exists as periodic snapshots. The
finer control is on the wrong half.

So always restore in this order:

1. **Restore the bucket snapshot first.** Railway → Bucket → Backups.
2. **Read that snapshot's timestamp.** It is the only moment both halves can agree on.
3. **Bring the database to THAT timestamp** — PITR to the bucket's time, or pick the
   database snapshot taken closest *before* it.

Choosing a database moment *after* the bucket's leaves rows referencing objects that
were never in it. Choosing one *before* only hides attachments that exist, which is
recoverable; prefer that direction if you must round.

Verifying a restore means opening **three claims that have photos** and confirming the
images load — not that the service starts. A restored database with an empty bucket
starts perfectly.

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
- `GET https://admin.mrclaims.live/login` returns 200
- `GET https://internal.mrclaims.live/login` returns 200
- `GET https://mrclaims.live/login` returns 200

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
- 5-min checks on `https://internal.mrclaims.live/api/health` — exercises web app + proxy + api end-to-end (the api has no public domain of its own)
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

The api exposes `/health`; web services are health-checked on `/login`. (The api's other public paths are `/api/auth/*`, `/api/registration`, `/api/activation` and the signature-protected `/api/attachments/raw` — everything else requires a session.)

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
- [ ] Default `*.up.railway.app` domains disabled on the web services (client-IP trust depends on CF-only ingress)
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
