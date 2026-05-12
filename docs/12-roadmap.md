# 12 — Implementation Roadmap

This is the sequential plan for Cursor to follow. Each phase produces working,
tested, deployable code. No phase starts until the previous is complete.

## Operating principles for Cursor

1. **Read all docs before starting.** Every task begins with: "I've read the relevant docs at `docs/XX-*.md`."
2. **Follow TDD.** Write the failing test first. Make it pass. Refactor.
3. **Small commits.** One logical change per commit. Conventional commit format.
4. **Ask before guessing.** If a requirement is ambiguous, ask Nikola — don't invent.
5. **No scope creep.** If you find a bug or missing feature while working on task X, file it as a TODO; don't fix it in the same PR.
6. **Verify with Nikola** at the end of each phase before moving on.

---

## Phase 0 — Foundation (target: 1–2 days of Cursor work)

Goal: Empty but fully wired monorepo that builds, runs locally, and deploys to staging.

### Tasks

1. **Monorepo skeleton**
   - Initialize pnpm workspace + Turborepo
   - Create folder structure per `docs/04-modules.md`
   - Set up `tooling/` with shared ESLint, TypeScript, Tailwind configs
   - `.gitignore`, `.editorconfig`, `.nvmrc` (node 20)

2. **Packages: `db`**
   - Install Drizzle + pg
   - Define every schema from `docs/02-data-model.md` (all tables)
   - Generate initial migration
   - Write seed scripts: permissions, system roles, departments, claim sources
   - Add `db:migrate`, `db:seed`, `db:studio` scripts

3. **Packages: `shared`**
   - All enums from `docs/02-data-model.md`
   - All Zod schemas (empty stubs OK for now, we'll fill per module)
   - Permission type + `Permission` union
   - Shared utilities (`normalizeName`, `parseExcelDate`)
   - 100% unit test coverage on utilities

4. **Packages: `auth`**
   - Better-Auth configured per `docs/05-auth-realtime.md`
   - Session model, cookie attributes, rate limits
   - RBAC helper layer (permission resolver with admin bypass)

5. **Packages: `logger`**
   - Pino setup, pretty-print in dev, JSON in prod

6. **Packages: `ui`**
   - shadcn/ui initialized
   - Basic primitives: Button, Input, Card, Dialog, Toast, Skeleton

7. **Packages: `i18n`**
   - Paraglide initialized with `sr` + `en`
   - Stub messages for navigation, common buttons

8. **App: `api`**
   - Hono app factory + server entry
   - Error handler middleware
   - Auth middleware + requirePermission middleware
   - Health endpoints
   - Rate limiting middleware
   - CORS config (off for MVP since frontends proxy)
   - Audit log module + service

9. **App: `admin-web`, `internal-web`, `portal-web`**
   - TanStack Start scaffolded
   - AppShell with sidebar (admin-web, internal-web) or simple header (portal-web)
   - Login page + login flow working end-to-end
   - 403 forbidden page
   - SSE connection hook (`useAuthEventStream`)
   - API proxy route (catch-all `/api/$`)
   - Language switcher

10. ✅ **Docker Compose** — Tačka 10 done
    - `docker-compose.yml`: Postgres (unchanged) plus **api** service built from `apps/api/Dockerfile`, hot-reload binds for `apps/api/src` + `packages`, Compose `DATABASE_URL` overrides host `localhost` with Docker DNS `postgres:5432`
    - Root **`pnpm dev`** runs **admin-web**, **internal-web**, **portal-web** in parallel (`./apps/*-web`); **`pnpm dev:all`** runs `docker compose up -d` then **`pnpm dev`**
    - README Local Development section documents URLs, migrate/seed, logs, rebuild

11. ✅ **CI pipeline** — Tačka 11 done
    - GitHub Actions `.github/workflows/ci.yml` on push/PR to **main**: format check, typecheck, lint, build, test (sequential); pnpm 9.15.9 + Node 20 with pnpm store caching
    - Root `pnpm test` (`turbo run test`); Turbo `test` task depends on `^build`

12. **Deploy skeleton to Railway staging**
    - All 5 services deployed
    - Health checks passing
    - Can log in as seeded admin

### Acceptance criteria for Phase 0

- [ ] `pnpm install && pnpm dev` starts all apps locally, no errors
- [ ] `pnpm test` passes (permissions + utilities)
- [ ] Admin can log in to admin-web staging with seeded credentials
- [ ] Admin sees empty dashboard with navigation sidebar
- [ ] SSE connection is active (verifiable in browser dev tools)
- [ ] `/api/health` returns 200 from all three frontend proxies
- [ ] Permission denied on any protected route returns 403

---

## Phase 1 — Functional Modules (target: 3–5 days)

Goal: Operators can create, view, edit EMOTIVE and DOMACE claims with attachments.
Historical Excel data is imported.

### 1.0 Permissions System (PREREQUISITE)

Before implementing module functionality, establish role-based access control across all three frontends.

- Extend Better-Auth session payload to include user roles array (via Better-Auth `additionalFields` or custom plugin)
- Add `requireRoles(...rolesAllowed)` helper to `@mr/auth` for use in TanStack Router `beforeLoad` callbacks
- Apply role checks to all routes in admin-web (`admin`), internal-web (`operator` + `admin`), portal-web (`client`)
- Add API-level permission checks per `.cursor/rules/05-security.mdc` (UI hiding is convenience layer, server is judge)
- Replace `TODO(phase-1.0)` comments throughout codebase
- Source of truth: roles seeded in `packages/db/src/seed/roles.ts` (`admin`, `operator`, `viewer`, `client`)

Estimated: 1–2 sessions.

### 1.1 Reklamacije CRUD

1. **Reference catalogs (CRUD + read APIs)**
   - `employees` — create, list, update, deactivate
   - `departments` — list, update (seeded)
   - `external_parties` — CRUD
   - `engine_types` — list, create (inline from claim form), update
   - `claim_sources` — list, update (seeded)
   - `customers` — CRUD

2. **Emotive claims module**
   - Repository: create, list (paginated, filtered), findById, update, softDelete
   - Service: enforces business rules, emits SSE events, writes audit log
   - Controller + routes with permission middleware
   - Validators for all inputs
   - Unit + integration tests (90%+ coverage)

3. **Emotive claim faults sub-module**
   - Attach multiple fault records per claim
   - Types: employee, department, external
   - Resolver for Excel `GRESKA` strings

4. **Domace claims module**
   - Same pattern as emotive
   - Per-year `sequence_number_yearly` logic (transactional counter)
   - Customer lookup or create

5. **Attachments module**
   - Storage service (volume implementation)
   - Upload endpoint with streaming
   - Thumbnail generation (sharp for images, ffmpeg for videos)
   - Download endpoint with auth + row-level check
   - Signed URL endpoint
   - Delete + cleanup logic

6. **Observations module**
   - Append-only notes per claim
   - Visibility flag (internal vs. client_visible)
   - Edit within 10 min, always delete own
   - Admin can delete any

7. **UI: internal-web**
   - `/emotive-claims` list page with DataTable, filters, pagination
   - `/emotive-claims/:id` detail page with tabs (Data, Observations, Files)
   - `/emotive-claims/new` create form (autosave, all fields)
   - Same for `/domace-claims`
   - Customer picker (ComboboxAsync with inline create)
   - Employee picker, engine type picker, department picker
   - File dropzone with preview grid
   - Confirm dialogs for destructive actions

8. **UI: admin-web**
   - Same claim pages as internal-web (admin can do everything operator can)
   - Admin-only: delete, restore, unarchive buttons visible

9. **ETL: legacy Excel import**
   - `scripts/etl-legacy-excel.ts` following `docs/06-excel-flow.md`
   - Admin UI page `/admin/import/legacy-excel`: upload → dry-run → approve
   - Progress via SSE

10. **Tests**
    - Unit: validators, normalizers, resolvers
    - Integration: every service method with permission variants
    - E2E: create emotive claim, create domace claim, upload attachment, edit claim

### Acceptance criteria for Phase 1

- [ ] Operator can create an EMOTIVE claim with all fields and see it in the list
- [ ] Operator can upload 3 images to a claim and view them
- [ ] Operator can edit a claim and changes are audit-logged
- [ ] Operator cannot delete a claim (403)
- [ ] Admin can delete and restore a claim
- [ ] Historical Excel import completes successfully for the provided file
- [ ] After import, UKUPNO-derived claims are visible in the list with correct years
- [ ] Filtering by year and outcome works in list view
- [ ] DOMACE claims created with new format have correct `sequence_number_yearly`
- [ ] Another operator editing the same claim triggers SSE refresh in the first operator's browser
- [ ] Coverage on claim modules ≥ 90%

## Architectural Checkpoints (Performance & Scaling)

Pre-flight checks before specific Phase 1 sub-phases. Each checkpoint is a reminder to evaluate whether a "stand-by" technology should be activated.

### Before Phase 1.2 (Dashboard with Statistics)

- **Zustand evaluation:** Dashboard will introduce shared filter state (date range, status, user). If implementing with React Context, watch for re-render performance issues. Threshold: > 5 context values OR > 3 listeners → migrate to Zustand before merging Phase 1.2.

### Before Phase 1.3 (Files and Findings)

- **CDN-ready file architecture:** File uploads must use S3-compatible storage (Cloudflare R2 or Backblaze B2) with presigned URLs. Do NOT serve files from the API server. Decision must be made and storage account provisioned before starting 1.3.
- **CDN provisioning:** Cloudflare in front of Railway (free tier sufficient initially). Configure DNS + cache rules for `/files/*` path.

### Before Phase 1.6 (Email integration)

- **Background job runner:** Email IMAP polling is a long-running background task. BullMQ is in the stack (already in @mr/db schema preparation). Activate Redis dependency in docker-compose, configure worker process.

### Before Phase 2 (TBD)

- **PWA evaluation:** If mobile use case becomes priority, add Vite PWA plugin and service worker.
- **Multi-region evaluation:** If non-Serbia users emerge, evaluate Edge runtime or read replicas.

---

## Phase 2 — Employees and statistics (target: 2–3 days)

Goal: Admin enters monthly employee output; statistics pages work for both markets.

### Tasks

1. **Employee output module**
   - CRUD for `employee_monthly_output`
   - Admin UI: `/admin/employee-output` — table of employees × months × years, editable cells
   - Bulk edit (enter multiple months at once)

2. **Stats services**
   - `EmotiveStatsService` — per-year, per-customer, per-employee counts
   - `DomaceStatsService` — per-year, per-outcome, per-department, financial totals
   - `OverallStatsService` — combined firm statistics (admin only)

3. **UI: internal-web**
   - `/stats/emotive` — tables + charts (per customer × year, per employee × year, outcome breakdown)
   - `/stats/domace` — tables + charts (counts, total amounts, outcome breakdown, fault department)
   - Year selector, date range filter

4. **UI: admin-web**
   - `/stats/overall` — combined view: total claims, accepted ratio, total revenue impact, top employees by ratio, top engine types

5. **Materialized views**
   - Create mat views per `docs/02-data-model.md`
   - Refresh scheduled nightly via pg_cron (or Node cron inside api)
   - Manual refresh button in admin stats page

### Acceptance criteria for Phase 2

- [ ] Admin can enter monthly assembly count for each employee
- [ ] Per-employee EMOTIVE stats page shows correct ratio (reklamacije / sklopljeno)
- [ ] Per-customer EMOTIVE stats page matches counts from source Excel's "EMOTIVE REKLAMACIJE" sheet
- [ ] DOMACE financial stats show total amount by outcome
- [ ] Overall stats page shows meaningful KPIs; accessible only to admin
- [ ] Charts render in under 500ms for 2+ years of data

---

## Phase 3 — Admin panel (target: 2–3 days)

Goal: Full user + role management, client registration approval, shifarnici, audit log.

### Tasks

1. **Users module**
   - Admin CRUD for users
   - Role assignment UI
   - Password reset trigger
   - 2FA management (enforce for admin, reset for any user)
   - Activate/deactivate

2. **Client registration flow**
   - Public registration page on portal
   - `client_registration_requests` table writes
   - Admin UI: `/admin/registration-requests` list + detail
   - Approve flow: choose customer + create user + send email
   - Reject flow: reason + email
   - SSE event to admin when new request arrives

3. **Roles module**
   - Admin CRUD for roles
   - Permission tree UI (grouped by module, collapsible)
   - Copy-from-existing helper
   - SSE propagation to affected users on role change
   - System roles cannot be deleted or renamed

4. **Shifarnici pages**
   - Departments
   - Engine types (with usage count)
   - External parties
   - Claim sources
   - Customers

5. **App settings**
   - `/admin/settings` page
   - OpenAI API key (masked, admin-only)
   - Rate limits (editable)
   - Session timeouts (editable)
   - Upload limits (editable)

6. **Audit log**
   - `/admin/audit` list with filters (entity, action, user, date range)
   - Detail view showing full change diff for `update` actions
   - CSV export

### Acceptance criteria for Phase 3

- [ ] Admin can create a new user, user receives email with password reset link
- [ ] Admin can create custom role "Senior Operator" with specific permissions
- [ ] Operator assigned Senior Operator role sees updated UI in < 5 seconds (via SSE)
- [ ] Client self-registers, admin sees notification, approves → client can log in
- [ ] Rejected client gets email with reason
- [ ] Audit log shows login, permission change, claim edits
- [ ] 2FA works: admin is forced to enable on first login; TOTP code required on subsequent logins

---

## Phase 4 — Excel export and translation (target: 1–2 days)

Goal: Export workbook matches source format; client portal works with translation.

### Tasks

1. **Excel exporter**
   - Workbook builder orchestrator
   - Each sheet generator per `docs/06-excel-flow.md`
   - Template workbook with pre-styled cells
   - Export options dialog (full / partial by market / year / customer / date range)
   - Download via API
   - Rate limit: 3 exports per user per minute

2. **Translation module**
   - OpenAI client wrapper
   - Cache table with LRU cleanup cron
   - Rate limits per user
   - Fallback to original text on failure

3. **Portal features**
   - Client list of own claims (filtered by `customer_users`)
   - Claim detail showing client-visible observations + attachments only
   - Per-field translate button
   - "Show original" toggle
   - Download button for claim's attachments (bundled zip)

### Acceptance criteria for Phase 4

- [ ] Exported workbook opens in Excel/LibreOffice with identical sheet names and column layouts as source
- [ ] Adding a new year's claim causes that year's sheet to appear in the next export
- [ ] Client sees only their customer's claims, nothing else (verify via integration test)
- [ ] Client clicks translate on Serbian warranty_report, gets English translation in < 3s
- [ ] Same translation on second click is instant (cached)
- [ ] Client cannot see internal observations even by URL manipulation
- [ ] Excel export completes in < 5s for full dataset

---

## Phase 5 — Polish and production launch (target: 1–2 days)

Goal: Production-ready, deployed, monitored.

### Tasks

1. **UI polish**
   - Loading states for every async UI
   - Empty states with helpful copy
   - Error boundaries on every route
   - Confirmations for destructive actions
   - Toast notifications for successes

2. **Performance**
   - Lighthouse score ≥ 90 on each app's login page and main pages
   - Bundle size check: each app < 300 KB initial gzipped
   - Lazy load heavy features (ETL import page, charts)

3. **Security hardening**
   - Review all routes for missing permission checks
   - Security headers (via Hono secure headers middleware)
   - CSP headers configured
   - `pnpm audit` clean
   - Dependency update to latest patches

4. **Cloudflare setup**
   - All WAF rules per `docs/01-architecture.md`
   - Rate limiting rules
   - Geo-blocking for admin
   - IP allow list for admin

5. **Backup verification**
   - Synology cron jobs tested
   - Full restore dry-run on staging

6. **Documentation finalization**
   - Update README
   - Admin user guide (how to add user, approve client, run import)
   - Runbook for common incidents

7. **Production deployment**
   - Domains configured in Cloudflare
   - Environment variables set
   - Initial seed run, admin password changed
   - Smoke tests passing

8. **Go-live**
   - Nikola logs in, verifies data, does final UAT
   - Invite first operator + first client

### Acceptance criteria for Phase 5

- [ ] All 3 frontends load in < 2s on Belgrade cable connection
- [ ] No console errors on any page
- [ ] WAF + rate limiting active and tested
- [ ] Backup cron verified last 7 days
- [ ] Production admin account works, first operator account created
- [ ] At least one client registered and can see test claim

---

## Post-launch: 2 weeks of stabilization

- Monitor error rates daily
- Fix any issues reported within 24h
- Gather feedback from Nikola + first operator + first client
- Triage feature requests into backlog

Only after 2 weeks stable do we consider any new features.

---

## Out of scope for MVP (explicit non-goals)

To prevent scope creep, these are **not part of MVP**:

- Mobile app (native)
- Offline mode
- Virus scanning on upload
- PDF claim report export (separate from Excel)
- Email digest / notifications beyond transactional
- Multi-currency support
- Advanced search with full-text indexing
- Custom fields per customer
- API for third-party integrations
- ERP integration (MR's existing systems)
- SSO / SAML
- Audit log export in format other than CSV
- Multilingual beyond sr + en
- Kanban-style claim board
- Automated claim-number generation across customers
- Webhooks
- Reports scheduled by email

Each of these is valid future work, captured in backlog. MVP ships without them.

---

## Estimated total: 12–17 days of focused Cursor work

Reality: first project always takes longer. Add buffer of 5 days for unforeseen issues.
Realistic target: **3–4 weeks of calendar time** from start to go-live.

---

## Task handoff to Cursor

When starting a new phase with Cursor, the prompt template:

```
Read the following files before starting:
- docs/04-modules.md
- docs/10-testing.md
- .cursor/rules/*.mdc
- docs/<phase-specific>.md

We are starting Phase <N>, task <M>: <title>.

Requirements:
- <list relevant acceptance criteria>

Before writing code:
1. Confirm you've read the rules
2. List the files you plan to create/modify
3. List the tests you plan to write
4. Wait for my approval

Then proceed TDD-style: write the failing test, show it to me, then implement.
```

This structure keeps Cursor on track and makes it easy to catch drift early.
