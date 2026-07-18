# CLAUDE.md — MR Reklamacije (consolidated context)

> One file to read first. Distillate of `docs/*`, `.cursor/rules/*.mdc`, `CONTRIBUTING.md`,
> root config, and the working agreement with Nikola. When this file disagrees with what
> you "remember", **the repo wins** — and fix this file.
> **`.cursor/rules/*.mdc` are binding** (they block PRs); this is their summary, not a replacement.

---

## 1. What we're building

Internal **warranty-claims** system for **MR Engines** (Serbia) — remanufactured engines.
Two claim kinds: **EMOTIVE** (international partners) and **DOMACE** (domestic).
Flow: engine intake → claim → processing (observations, files, fault attribution by
employee/department/external party) → outcome (`pending` / `accepted` / `rejected` / `archived`).
Plus statistics, Excel import/export, OpenAI translation, and a client portal.

Domain terms kept verbatim (never translate/rename): **EMOTIVE, DOMACE, UKUPNO, MR NUMBER, GRESKA, APPROVED GREEN, GODINA**.

### Architecture — 3 isolated SPAs + 1 API

| Service        | Tech           | Role                                                                     | Domain / port              |
| -------------- | -------------- | ------------------------------------------------------------------------ | -------------------------- |
| `api`          | Hono + Node    | REST, auth, business logic, SSE — **the only thing that touches the DB** | api.mrengines.rs / `:3000` |
| `admin-web`    | TanStack Start | **Central control plane** (users, roles, šifarnici, audit, settings)     | admin.\* / `:3001`         |
| `internal-web` | TanStack Start | Employees + viewers (claim processing)                                   | interno.\* / `:3002`       |
| `portal-web`   | TanStack Start | Clients (read-only, their own claims)                                    | reklamacije.\* / `:3003`   |

- Frontends **proxy `/api/*`** to the API over Railway's private network → browser calls are same-origin; never hits `api.mrengines.rs` directly. No browser CORS.
- **Physical isolation:** admin JS never ships to clients. **Host-only cookies per subdomain** — auth on internal ≠ auth on admin (intentional). Never import UI between apps; shared UI lives in `@mr/ui`.
- Stack: TanStack Start (React 19, Vite, SSR) · Hono · PostgreSQL + Drizzle · Better-Auth + custom RBAC · Paraglide (sr/en) · shadcn/ui + Tailwind v4 · ExcelJS · OpenAI · Vitest + Playwright · Railway + Cloudflare.

### Packages (`@mr/*`) and dependency direction (STRICT, CI-enforced)

`db` (Drizzle schema/migrations/seed/client) · `shared` (Zod schemas, enums, **permissions**, constants, pure utils) · `auth` (Better-Auth config + permission resolver) · `excel` · `i18n` (Paraglide) · `ui` (shadcn layer) · `logger` (pino). Tooling: `eslint`, `typescript`, `tailwind`, `vite` (`@mr/dev-vite`).

- `apps/*` → may depend on `packages/*`. **`packages/*` may NEVER depend on `apps/*`.**
- `packages/db` depends only on `packages/shared`. **No circular deps — ever** (depcruise enforces).
- Shared logic between two apps → goes in `packages/shared`.

### API module anatomy (mandatory per `apps/api/src/modules/<name>/`)

`schema.ts` (re-export from @mr/db) · `validators.ts` (Zod) · `repository.ts` (DB only) · `service.ts` (business logic, events, audit) · `controller.ts` (thin HTTP) · `routes.ts` (perm middleware) · `__tests__/`.
**Layer law:** controller never touches DB; service/repository never import `hono`/HTTP types. DI via `apps/api/src/core/container.ts` (constructor injection) — no module-level singletons/globals. `process.env` only inside `core/config/env.ts`.

---

## 2. Domain invariants — these are DESIGN, not bugs (don't "fix" them)

- **RBAC:** permissions are atomic, defined in code (`@mr/shared` permissions); roles live in DB; effective perms = union of role perms. **The server is the judge** — UI hiding & route loaders are courtesy; every route has `requirePermission('...')`.
- **Admin bypass:** `admin` role gets `ALL_PERMISSIONS` hard-coded in the resolver — never relies on `role_permissions` integrity. An admin can never be locked out.
- **NIKOLA-SAFE:** the protected super-admin (`screenfun99@gmail.com`) cannot have roles/status changed by anyone; self-role-change is forbidden. Enforced server-side.
- **Orphan engine-type protection** — intentional guard. Don't flag.
- **Claims rules (locked, `docs/04`):** EMOTIVE & DOMACE have **separate** detail routes/forms/loaders — never a shared `ClaimDetail` that branches on `kind`. `kind` comes only from the API, never inferred from field shape. One aggregate detail fetch per claim (JOIN in repo, route loader, `defaultPreload: 'intent'`). Create/update = one endpoint, one transaction (claim + faults). **No optimistic updates for claim create/edit** (only for small actions like status change, with rollback).
- **Claims are always editable (2026-07-18, editing-freedom Phase 1):** no outcome-based edit lock — a claim (either kind) is editable in any outcome state (`pending`/`accepted`/`rejected`/`archived`); every change is audit-tracked. Outcome change and delete both go through `<ConfirmDialog>` in the UI. The `emotive_claims.reopen`/`domace_claims.reopen` permissions and the `claim-lock.ts` guard layer were retired — don't reintroduce them. DOMACE repair-amount fields stay editable only when `outcome = accepted` (kept, unchanged). EMOTIVE client-facing outcome visibility was untouched by Phase 1 — it shipped as its own Phase 2, see the invariant below.
- **EMOTIVE client visibility — private→published (Phase 2, 2026-07-18):** an EMOTIVE claim has two nullable `timestamptz` columns, `client_visible_at` and `published_at` (migration `0027`; existing rows backfilled `published_at = created_at` so nothing hides retroactively). Server-computed `clientPhase` (`deriveClientClaimPhase(outcome, { clientVisibleAt, publishedAt })` in `@mr/shared`) drives 3 client stages: **Primljeno** (both null) → **U obradi** (`client_visible_at` set + `published_at` null, or published-but-`pending`) → **Ishod** (`published_at` set + decided). **Gate A (auto, monotonic):** the first non-empty client-visible inspection report save sets `client_visible_at = COALESCE(client_visible_at, now())`. **Gate B (explicit):** `POST /api/emotive-claims/:id/publish` (permission `emotive_claims.publish` — operator + admin), idempotent, audits `{transition:'publish'}`, SSE `publishClaimUpdated`. **Masking:** while `published_at IS NULL` the client wire (`toClientClaimDetail`/`toClientClaimListItem`) masks `outcome`→`pending` and `dateOfFinish`→`null`; a Primljeno claim (both null) 404s on detail/attachments/client-PDF for `view_own_customer` (not 403 — don't leak existence). Visibility is **portal-only** — statistics, Excel, and internal views always read the real outcome; the outcome-change email only fires once a decided outcome is actually client-visible (`published_at !== null && outcome !== pending`). **Freshness — NEW/UPDATE (Phase 3, 2026-07-18):** a nullable `timestamptz` `client_content_updated_at` on `emotive_claims` (migration `0028_boring_sphinx`, existing rows NULL) bumps to `now()` on any **client-visible** content change (whitelisted field edit, client-visible attachment add/remove, Gate A, Gate B publish) — **internal-only edits (notes, faults, amounts) never bump it**, and it is **not monotonic**. Per-client-**user** last-seen lives in `emotive_claim_client_views(user_id, emotive_claim_id, viewed_at)` (composite PK, FKs cascade). The unified `/api/claims` list computes `freshness: 'new' | 'update' | null` per requesting client user (LEFT JOIN + CASE): shown when the claim is openable AND `client_content_updated_at` is set AND (never viewed OR changed since last view) — label **`new`** while `published_at IS NULL`, **`update`** once published. Opening the claim detail (`GET /api/emotive-claims/:id` for `view_own_customer`) upserts the view row, clearing the badge until the next content change; internal full-view reads never record a view. Raw timestamps never leave the server — only the derived label. **EMOTIVE only** — DOMACE has no portal, its list branch always returns `NULL` freshness.
- **SSE = signal only:** events carry `type + kind + id`, never full payloads. Client calls `invalidateQueries`; never writes fetched rows into cache from SSE. Server is single source of truth.
- **Admin = control plane (`docs/13`, binding):** every feature must leave an "admin hook" — (1) state changes write audit, (2) categories live in a registry not hardcoded, (3) gated actions map to a named permission, (4) catalogs are CRUD-able from admin, internal only reads.
- **Soft deletes only** for business data (`deleted_at`); repos filter `deleted_at IS NULL` by default. Forward-only migrations (revert = new migration).
- **Fault attribution:** a fault row has exactly one of `{employeeId, departmentId, externalPartyId}` (CHECK constraint), keyed by `fault_type`.

---

## 3. Working agreement with Nikola (HOW we work)

**Nikola is the owner, not a developer.** Explain clearly in **Serbian**; no unexplained jargon. He wants "a well-oiled machine — everything communicates smoothly, code clean, no patched holes (krpljene rupe)."

Cycle for every task: **PRE-CHECK (read/understand) → PLAN or show the proposal → STOP for approval → code → full gate → commit → STOP.**

- **You propose, Nikola/the operator approve before code.** No partial patches. No scope creep (find an unrelated bug → report it, don't fix it in the same change).
- **Migrations and auth are touched only with explicit approval.** For a migration: verify the journal first, generate via `drizzle-kit` (never hand-write SQL), prove clean migrate-from-zero on an empty DB, and confirm it's only the intended DDL before applying.
- **Show design decisions before applying** (e.g. color-token mappings, anything that changes visible behavior). If a needed token/resource is missing, propose the mapping and wait.
- **Full CI gate must be green before any commit.**
- **Commit only when explicitly asked**; use conventional-commit messages. **Nikola pushes** (you don't `git push`). After a push he restarts & verifies in the browser.
- **Never start or kill the dev servers.** `pnpm dev:all` lives in Nikola's terminal. For verification use one-off commands that exit (tests, `pnpm dev:check`), never touch his session.
- **Never interrupt `pnpm install`** (a partial install corrupts `node_modules`).
- When a rule/doc contradicts reality, say so explicitly and let Nikola decide — don't silently pick one.

---

## 4. Commands

```bash
# Full gate (what we run before every commit — all must exit 0)
# ⚠️ ALWAYS --force the cacheable tasks before a PUSH: turbo's local cache
# masked 3 CI failures on 2026-07-17 (stale api build/lint + shared test hits
# while their inputs had errors). CI runs cache-less and caught them one by one.
pnpm format:check && pnpm exec turbo run build typecheck lint test --force \
  && pnpm --filter api depcruise && pnpm test:integration
# (CONTRIBUTING's pre-commit order: format:write, typecheck, test, test:integration, lint, depcruise, format:check)

# Dev (NIKOLA runs these — not you)
pnpm dev:all            # Postgres → API(:3000) → 3 frontends(:3001-3003), frees ports, waits for health
pnpm dev:check          # preflight: Postgres, API, ports, node_modules, phantom pins
pnpm dev:audit-deps     # after bumping better-auth / nitro / @tanstack/react-start

# Database
pnpm --filter @mr/db run db:migrate     # apply migrations (drizzle-kit, local dev)
pnpm --filter @mr/db run db:migrate:deploy  # prod migrator (Railway pre-deploy): required extensions + all migrations, idempotent, works from-zero
pnpm --filter @mr/db run db:seed        # idempotent SYSTEM seeds only (prod-safe: permissions, roles, departments, claim_sources, engine_manufacturers)
pnpm --filter @mr/db run db:seed:demo   # system + DEMO data (sample claims/employees/customers) — dev/test only, NEVER prod
pnpm --filter @mr/db run db:generate    # generate a migration from schema diff
pnpm create-admin                       # once per fresh DB

# DB access (dev)
docker exec -it mr-reklamacije-postgres psql -U mr -d mr_reklamacije
# host localhost:5433 · user mr · pass mr_dev_password · dev db mr_reklamacije · test db mr_reklamacije_test
```

### Restart procedure after touching `@mr/ui` or the Tailwind preset (stale CSS/dist lesson)

Dev resolves workspace packages from **`src/`** (the package `"development"` export + Vite `ssr.noExternal`), **not `dist/`** — but **typecheck/build read `dist` types**, and **preset/token (CSS) changes need Tailwind to regenerate**. So after editing `@mr/ui` or `tooling/tailwind`:

1. kill ports 3000–3003 (`lsof`/the dev runner) → 2. `pnpm --filter @mr/ui build` → 3. `pnpm dev:all` → 4. **hard refresh** (Cmd+Shift+R).
   Symptom of staleness: Vite logs `page reload packages/ui/dist/...`, or 504/login flicker (API starved by dist watchers). `pnpm dev:check` then `pnpm dev:all`.

### Clean migrate-from-zero (proof before pushing a migration)

Empty DB needs these extensions first (the app's integration setup installs them; they are NOT in migrations):
`uuid-ossp`, `pgcrypto`, `citext`, `pg_trgm`. Then `drizzle-kit migrate` applies `0000..NNNN`. Integration tests' global setup already does migrate-from-zero on `mr_reklamacije_test`, so a green `test:integration` also validates the migration chain.

---

## 5. Brandbook & UI (`docs/09`, `docs/15`)

- **Colors only via `mr-*` tokens** in `tooling/tailwind/index.css`. Never hardcode Tailwind palette colors (`violet-*`, `amber-*`, `bg-[#...]`) — extend the preset instead. Dark mode via `dark:` + semantic tokens.
- **Semantic hues (now 6 + neutral):** `mr-brand` (red #ED1C24), `mr-error` (red #D92D20), `mr-warning` (amber), `mr-success` (green), `mr-info` (blue), **`mr-accent` (teal #0E9384 — 6th hue, brand extension, approved by Nikola)**, `mr-neutral` (grays). Each has `-strong` / `-subtle`.
- **All badges share `BADGE_SHELL_CLASSES`** (exported from `@mr/ui`) for consistent hover/transition, plus a color map in the `OUTCOME_BADGE_CLASSES` shape. Color constants for outcome/kind live in `@mr/shared/constants/*-colors.ts`.
- **Badge palette (role badge & status badge are always distinct in a row):**
  admin=`mr-brand` · operator=`mr-info` · viewer=`mr-neutral` · client=`mr-accent` || pending=`mr-warning` · approved=`mr-success` · rejected=`mr-error`. (admin-red vs rejected-red never co-occur — admin is the protected super-admin.)
- **Typography:** use `<Heading>` from `@mr/ui` (brandbook levels) — no ad-hoc `text-3xl`. Font **Figtree Variable** (+ JetBrains Mono for IDs/MR numbers). _(Note: `.cursor/rules/04-ui.mdc` still says "Inter" — outdated; brandbook + `docs/09` + perf rule say Figtree.)_
- shadcn/ui base, `lucide-react` icons only, `@tanstack/react-table`/`-form`/`-query`, `recharts`, `sonner`. Other libs need Nikola's OK.
- Destructive actions always go through `<ConfirmDialog>` (never `confirm()`/`alert()`). Skeletons not spinners. Empty/loading/error states on every list. Permission gating via `<Can>` + route `beforeLoad` (UI is courtesy).

---

## 6. Conventions distilled from `.cursor/rules/*.mdc`

**Style (01):** files `kebab-case`; components `PascalCase` (file matches); `camelCase` vars; `SCREAMING_SNAKE_CASE` constants. One primary export per file. Absolute imports (`@mr/*`, `@/`) — no `../../../`. `async/await` (not `.then`). Guard clauses over nesting. Functions < 30 lines. **No dead/commented-out code.** Comment **why**, not what. Throw typed domain errors (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`), never bare `Error`; never swallow errors. **No semicolons**, single quotes, 2-space, trailing commas; Prettier in CI. Conventional commits.

**TypeScript (02):** `strict` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`. **`any` banned** in prod (tests/`.d.ts` only) — use `unknown` + narrow, or Zod. **No `enum`** → `as const` objects + derived type. `never` exhaustiveness in switches. **Non-null `!` banned** → assertion functions. Zod is the boundary source of truth (`z.infer`). Named exports (default only for React components / TanStack route files). No magic strings (constants in `@mr/shared`). Explicit return types on public/package exports, service/repo methods, and Query hooks.

**Testing (03, 10):** TDD expected. **Real Postgres in tests** — never mock DB/Zod/domain services/Hono. Always mock time (`vi.setSystemTime`), randomness, external APIs (OpenAI mocked except `[real-api]`). **Exception — SQL-driven time:** when the window under test is computed in Postgres (`CURRENT_DATE`/`now()`, e.g. the statistics rolling-24-month trend), `vi.setSystemTime` can't move it (it mocks only the JS clock) — so mocking would just desync JS-built fixture dates from the DB window. Instead **clamp fixture dates to stay inside the current period** (see `statistics.integration.test.ts` `daysAgo` — clamps to the 1st of the current month). Not a mistake; it's the root-cause fix for SQL-driven time. No `skip`/`only`/commented tests. Coverage (CI-enforced): services 90%, repos 85%, controllers 80%, utils 100%, overall API 85%, excel 95%, auth 95%, web components 70% (warn). E2E single-worker, stable selectors (`getByRole`), never `waitForTimeout`. Every bug fix ships a regression test. Test DB must end in `_test` (`assertIntegrationDatabase` refuses dev/non-`_test`).

**Security (05) — a security bug is SEV-1:** every route `requirePermission` (only `/api/health` exempt). Defense in depth (CF WAF → rate limit → auth → permission → service → repo → Zod) — never remove a layer. Validate every input with Zod (parse `:id` too). **Never leak** `password_hash`, secret `app_settings`, internal notes/attachments to client role. Row-level filtering for `view_own_customer`. Return **404 not 403** when a user lacks row-level access (don't leak existence). Drizzle parameterized only; `sql\`${param}\``ok, never`sql.raw`with user input. Secrets only in env /`app_settings(is_secret)`; gitleaks in CI. Files: magic-byte MIME check, size limits, paths from UUIDs, `Content-Disposition: attachment`+`nosniff`, signed URLs 5 min. Audit every state change (actor+IP+UA, action, entity, diff) — even admin. Session revoked on deactivate / password / 2FA change.

**API design (07):** `/api/<resource>/<id>/<sub>/<verb>`; paths kebab-case, query/JSON camelCase, DB snake_case. `GET`/`POST`/`PATCH`(preferred)/`PUT`(rare)/`DELETE`(soft). Status codes per table (201+`Location` on create, 204 on delete, 422 semantic, 409 conflict, 429 rate). List response `{ items, total, page, pageSize }`; single = bare object; error `{ error, message, code, details }`. Verb endpoints for non-CRUD (`/:id/change-outcome`, `/:id/approve`). Whitelist sort fields. Audit in the **service** layer (so direct calls audit too).

**Database (06):** schema in `packages/db/src/schema/*`, imported everywhere via `@mr/db`. Drizzle only; raw SQL via template literal when needed. Tables snake*case plural; FK `<singular>_id`; explicit index/constraint names (`idx*...`, `fk\_...`). Enum-like columns = `text`+ CHECK (extensible), not PG enum. Money`decimal(14,2)`. `date`for date-only (UTC midnight),`timestamptz` for moments. **Index FKs and WHERE/ORDER BY/JOIN columns** (Drizzle does NOT auto-create FK indexes) — but don't over-index. Multi-row writes in a transaction. Seeds idempotent (`onConflictDoNothing`), split: `runSystemSeeds`(permissions → roles → departments → claim_sources → engine_manufacturers; prod-safe) +`runDemoSeeds`(employees → customers → engine_types → demo claims; dev/test only — integration globalSetup runs both; real data comes from`import-legacy`). **NEVER** `TRUNCATE`/`DROP`prod, connect to prod from local (except read-only tunnel), ship data-deleting migrations without Nikola's OK, or`ON DELETE CASCADE` on business tables except clear parent-child (faults).

**i18n (09-rule):** every user string via Paraglide `m.*`; keys English `namespace_context_variant` (`action_save`, `validation_required`, `nav_emotive_claims`). Both `sr.json` + `en.json` required (CI checks parity). Serbian is primary, informal "ti" form, follow the glossary (always "Prilog", never a synonym). ICU plurals (Serbian one/few/other). Never concatenate translated strings — interpolate. Don't translate IDs/MR numbers/proper nouns; format dates/numbers via `Intl.*`.

**Performance (10):** queryOptions factory in `@mr/shared/src/queries`; route loaders prefetch (`ensureQueryData`); `useSuspenseQuery` + Suspense over `isLoading`. Selective columns in list queries, full row + relations in detail. JOINs never N+1. Index FK + WHERE columns. Debounce inputs 300ms. Lazy-load heavy routes. Bundle budgets: admin/internal < 250KB, portal < 150KB gzipped. API p95 < 200ms, DB query p95 < 50ms. _(See drift note on pagination & optimistic updates below.)_

**Anti-patterns (08) — never commit:** god files (>500 lines), magic numbers, copy-paste ×3 (extract), N+1, swallowed errors, mixed concerns in controllers, TODO without issue/date, module-level mutable state / global singletons, `any` to silence, nested ternaries (use a lookup map), commented-out code, `utils.ts` dumping grounds, fetching in `useEffect` (use Query), `useEffect` for derived state, direct DOM/`dangerouslySetInnerHTML`, `console.log` in prod (use pino), boolean param traps (use options object), re-inventing libs, hardcoded URLs (use relative `/api/...`).

**Phantom deps (CONTRIBUTING):** these are pinned because upstream under-declares them — **don't remove casually**: `@opentelemetry/api@1.9.1`, `jose@6.2.3`, `kysely@^0.28.14` (apps/api, via better-auth), `youch@4.1.1` + `youch-core@0.3.3` (root, via Nitro). Re-audit with `pnpm dev:audit-deps` after bumping better-auth / Nitro / @tanstack/react-start.

---

## 7. Where things live

- **Schema / migrations:** `packages/db/src/schema/*.ts`, `packages/db/migrations/` (+ `meta/_journal.json`). Seeds: `packages/db/src/seed/` (`run-system-seeds.ts` orchestrates). Test helpers: `packages/db/src/test-helpers/integration-*.ts`.
- **Permissions / roles / enums / Zod / query factories:** `packages/shared/src/` (`permissions.ts`, `constants/`, `schemas/`, `queries/`).
- **Auth:** `packages/auth/src/` (`better-auth.config.ts`, permission resolver, `revoke-user-sessions.ts`).
- **API core:** `apps/api/src/core/` (`container.ts`, `middleware/` incl. `require-permission.ts`, `errors/`, `config/env.ts`). Modules under `apps/api/src/modules/<name>/`. SSE in `modules/events/`. Excel in `modules/excel/` + `@mr/excel`.
- **UI tokens/badges:** `tooling/tailwind/index.css` (tokens), `packages/ui/src/lib/badge-styles.ts` (`BADGE_SHELL_CLASSES`), `packages/ui/src/components/*-badge.tsx`. Admin user badges: `apps/admin-web/src/components/users/`.
- **Brandbook:** `docs/15-brand-guidelines.md` (authoritative) + `MR Engines Brandbook.pdf`.

---

## 8a. Known issues (real bugs, fix later — don't trip over)

- ~~Users-list keyset pagination broken past page 1~~ **FIXED**: `users.repository.ts` now mirrors the audit-log pattern (`created_at::text` cursor compared via `::timestamptz`); regression test in `users.integration.test.ts` ("paginates past the first page"). All other keyset usages key on text/integer columns and were already fine.
- ~~Portal claims list client-side pagination over ≤50 (latent cap)~~ **FIXED** in the portal v2 redesign: `clientClaimsListOptions(page)` is server-side paginated (10/page), no cap, no client-side slice; `portal_claims_capped` caption removed.
- ~~`/api/dashboard/summary` leaked GLOBAL data to portal clients~~ **FIXED** (SEV-1): the gate accepted `view_own_customer` and the queries had no customer scoping, so a client could read other customers' names/MR numbers. Now `/summary` requires full `emotive_claims.view`/`domace_claims.view` (route + service, defense in depth); clients use the scoped `/api/dashboard/client-summary` projection. Regression tests in `dashboard.integration.test.ts`.

## 8. Known drift (docs/rules vs reality — fix later, don't trip over)

- **UUID v7 vs v4:** `.cursor/rules/06` + `docs/02` say "UUID v7 only, `crypto.randomUUID()` forbidden for PKs." **Reality:** schema uses `uuid('id').primaryKey().defaultRandom()` (v4). Repo reality wins for now. **Decision for later (not in passing):** either migrate the schema to v7 (sortable IDs → better index locality) or relax the rule to "v4 OK". Pick deliberately; don't change PK generation mid-task.
- **Integration test isolation:** `docs/10` + `DEV_SETUP` say "transaction-per-test (BEGIN/ROLLBACK)." **Reality:** shared `mr_reklamacije_test` DB; global setup migrates+seeds once; suites use `TRUNCATE`/manual delete and must seed their own prerequisites. **This drift is not theoretical — it already caused an order-dependent failure** (a new suite called `seedRoles` without seeding `permissions` first; another suite's `TRUNCATE` wiped them → FK 23503). Fixed in **commit `18241cd`** by seeding permissions before roles. Lesson: when writing a new integration suite, **seed permissions before roles** (or call `runSystemSeeds`); never rely on another suite's seed surviving.
- **Pagination:** `rules/06` says offset OK for MVP; `rules/10` says cursor for >100 rows. Current claims lists use offset. Treat cursor as the target for large lists, not a retrofit mandate.
- **Optimistic updates:** `rules/10` C4 says "every mutation optimistic"; `docs/04` (claims, locked) says **no optimistic for claim create/edit**, only small actions; `docs/05` SSE is invalidate-only. The **claims rule wins for claims**; optimistic is fine for small toggles with rollback.
- **Font:** `rules/04-ui` says Inter — outdated; use **Figtree**.
- **`users.account_status`:** reality is ahead of docs — migration `0016` added `account_status` (`pending`/`approved`/`rejected`) and the approval flow assigns a role on approval (`operator`/`viewer`/`client`, super-admin excluded). `docs/05`/`docs/02` still describe only `is_active` + `client_registration_requests`; the user-approval path is the newer mechanism. **Approving as `client` also links the user to ≥1 EMOTIVE-partner customer via `customer_users` (atomic, in the approve transaction; gated by `customers.link_users`)** — that link is what the `own_customer` row-level scope reads.
- **`client_registration_requests` is a DEAD table — do not use it.** It exists in the schema (`packages/db/src/schema/client-registrations.ts`) + has an enum (`ClientRegistrationStatus`), but has **zero** endpoint/service/UI wiring. The live registration→approval mechanism is the unified `users.account_status` flow above. Don't mistake the table for the path; if client self-registration is built (portal Phase C), decide deliberately whether to revive it or stay on `accountStatus` (current direction: stay on `accountStatus`).
- **Connection pool size:** RESOLVED — reality is node-postgres defaults (max **10**, idle 10 s, `connectionTimeoutMillis: 0`); `rules/10`'s "20" is wrong. Explicit pool options (+ statement_timeout) remain a deliberate future choice.

---

## 9. Current state / recent work (this collaboration)

- **EMOTIVE client freshness Phase 3 (2026-07-18, commits `fa8e824`..`c699c6b`, shipped on `client-visibility-phase3`):** NEW/UPDATE badge on the portal claim list — see the §2 invariant for the full model. `packages/db` migration `0028_boring_sphinx` (nullable `emotive_claims.client_content_updated_at` + new `emotive_claim_client_views` table, no backfill needed — NULL means never bumped); `apps/api` bumps the column on client-visible content changes only, adds the unified-list `freshness` LEFT JOIN + CASE (per requesting client user), and upserts a view row on `GET /api/emotive-claims/:id` detail open; `apps/portal-web` renders the chip on `ClientClaimListItem.freshness`. EMOTIVE only — DOMACE untouched. **No new permission this phase → no prod seed needed after deploy**; migration runs via the existing `db:migrate:deploy` pre-deploy step.

- **EMOTIVE client-visibility Phase 2 (2026-07-18, commits `87c4f69`..`85bb8c8`, shipped on `feat/client-visibility-phase2`):** private→published claim lifecycle — see the §2 invariant for the full model. High-level: `packages/db` migration `0027_wonderful_dreaming_celestial` (2 columns + backfill); `packages/shared` (`deriveClientClaimPhase` gains the two-timestamp signature, `clientPhase` added to the client wire, masking in `toClientClaimDetail`/`toClientClaimListItem`, new `emotive_claims.publish` permission + `OPERATOR_PERMISSIONS`); `apps/api` (`EmotiveClaimsService.findById`/`ClaimContextService.loadClaimContext` 404-gate a Primljeno claim for `view_own_customer`, Gate A wired into the inspection-report save path, Gate B = new `POST /:id/publish` endpoint+route+service+repo, outcome email guarded on `published_at`, dashboard client-summary + activity feed made visibility-aware); `apps/internal-web` (publish action + claim stage indicator); `apps/portal-web` (live 3-bar status from server `clientPhase`, Primljeno card non-clickable). DOMACE and internal/statistics/Excel outcome reporting are unchanged — visibility is portal-only. **Prod follow-up (not yet done):** after deploy, run `pnpm --filter @mr/db run db:seed` once to insert `emotive_claims.publish` and grant it to `operator` (seed is additive; admin gets it via the `ALL_PERMISSIONS` bypass already).

- **MR-registry hole incident (2026-07-17, FIXED):** Nikola created a duplicate `7167/25` with no warning and no 409 — prod `mr_registry` held **3 of 127** numbers because `import-legacy` inserts claims directly and never wrote the registry (migration 0010's backfill predates the last legacy import). Fix: (1) approved one-off prod backfill (INSERT…SELECT with `ON CONFLICT (mr_key) DO NOTHING`, 124 rows, verified 0 missing + live warning works); (2) new `backfillMrRegistry(db)` in `packages/db/src/maintenance/` (uses `sqlNormalizeMrKey` — NOTE: pass `sql.raw('col')`, the string overload binds a LITERAL) now runs at the end of every `import-legacy` apply, with integration tests. Deleted claims correctly stay unregistered (release-on-delete is design).

- **Grupa D — business-value features (2026-07-17, commits `59b3719`, `22455d5`, `af1c97d`, full gate green, NOT yet pushed):** (D1) MR-number duplicate pre-flight — `@mr/shared` mr-registry query factory + debounced warning under the MR field in BOTH create forms with a link to the owning claim; `ApiError` now carries envelope `details` (was dropped in `parseApiErrorBody`) so the MR-key 409 also links to the conflicting claim. Warning is `checkMrDuplicate` opt-in because detail-edit reuses the same field components (own MR would false-positive). (D2–D4) Statistics: three new `/summary` sections honoring all existing filters — `domaceAmounts` (SUM of DOMACE total_amount + count, new KPI cell, EUR), `byCustomer` (EMOTIVE per-partner with outcome counts, "Po partneru" rank chart), `byFaults` (first read of fault tables: per employee/department/external party, "Kvarovi" 3-card section). Integration tests isolate via a per-test manufacturer filter (container writes COMMIT through the pool — rows persist across tests AND runs; year buckets alone are not safe). (D5) EMOTIVE outcome-change → signal-only bilingual email to approved portal users of the claim's customer (fire-and-settle, EmailPort-gated, admin toggle `app_settings emotive_claims.notify_client_on_outcome='false'`, new repo lookup `getOutcomeNotificationRecipients`; DOMACE excluded — no customer FK). Remaining D candidates NOT built: fault-analytics deep-dive beyond ranks, `employee_monthly_output` writer (Excel PROCENAT — needs its own design), byCustomer for DOMACE (needs firms design, docs/16).

- **Pre-commit deploy audit (2026-07-06/07, multi-agent, all fixes applied):** (1) BLOCKER — internal-web prod bundle 500'd on every route: Nitro's externals tracer ships a partial `tslib` when direct `@radix-ui` deps (vendored TipTap primitives) are externalized; fixed via `/^@radix-ui\//` in `ssr.noExternal` (internal-web only — other apps have no direct radix deps), proven by booting the built server (`/login` 200). (2) One-off scripts now run in the prod image: `COPY scripts` in Dockerfile (create-admin), `--env-file=.env` dropped from `import-legacy`/`recompress-attachments` (in-script `process.loadEnvFile` try/catch — dev unchanged, Railway env works), `import-legacy -- --file <path>` override (runbook: upload JSON to `/data`). (3) Dockerfile: `pnpm fetch` dep layer keyed on lockfile. (4) docs/11 + `.env.example` accuracy pass (public paths list, optional-var semantics, HOST=`::` — Railway private net is IPv6, API_BASE_URL/BETTER_AUTH_URL = public interno origin since signed attachment URLs are browser-facing, UptimeRobot via proxy URL, VITE_API_URL prod warning); `packages/email/node_modules` added to compose shield list. (5) SECURITY FIX (approved 2026-07-07): client IP now derived ONLY via `clientIpOf` (`apps/api/src/core/http/client-ip.ts`) — `CF-Connecting-IP` first (CF overwrites it; trust requires the default `*.up.railway.app` web domains be DISABLED, runbook/checklist item), else RIGHTMOST `X-Forwarded-For` entry (proxy-appended), validated with `net.isIP`, else null. Both consumers (rate-limit keying, audit `actorIp`) route through it; `x-real-ip` no longer read; regression tests incl. forged-leftmost-XFF bypass. **Follow-up (2026-07-15):** Better-Auth's OWN IP path (the Login audit row / `session.ipAddress`) previously bypassed `clientIpOf` and used the library-default forgeable LEFTMOST `x-forwarded-for`; now pinned to `cf-connecting-ip` via `advanced.ipAddress.ipAddressHeaders: ['cf-connecting-ip']` in `packages/auth/src/options.ts` (NOT `+ x-forwarded-for` — Better-Auth reads it leftmost too, which would reintroduce the forgeability), with an integration regression test (`packages/auth/src/__tests__/integration/login-ip-source.integration.test.ts`) and `docs/01` reconciled to the implemented value. Deferred: container runs as root (Railway isolation + Chromium path complexity).

- **Deploy prep (2026-07-06, D-1..D-4 DONE, deploy itself pending):** D-1 seeds split (`1d532af`), D-2 `/api` proxy (`64eb668`), D-3 = `db:migrate:deploy` (extensions + migrations, works from-zero — extensions can NOT be a migration file, `citext` is needed by `0000`), production `apps/api/Dockerfile` (compose `prod-like` overrides CMD to dev), `railway.json` in all 4 app dirs (api: Dockerfile builder + `preDeployCommand` migrator + `/health`; web: Nixpacks turbo build + `/login`), D-4 = `docs/11` rewritten to reality (in-app proxy routing, real env list from `apps/api/src/config/env.ts`, first-deploy runbook, api has NO public domain). Next: actual Railway setup with Nikola (account, env vars, volume, DNS).

- **NEXT UP — Machining claims + Firms design (2026-07-06):** `docs/16-machining-and-firms-design.md` is the approved-direction design doc (status: PREDLOG reviewed with Nikola, implementation NOT started). Key decisions: machining = ONE new claim family `machining_claims` (NOT a third EMOTIVE/DOMACE variant — orthogonal axes), `machining_part_types` catalog (7th catalog-pattern instance, seed glava/blok/radilica), part↔engine claim link via one-of `linked_emotive_claim_id`/`linked_domace_claim_id`, radni nalog = the only required form field. Firms: portal header company from `client-summary` firmNames (customer_users link, not first claim), inline "+ Nova firma" in the approve dialog (same customers.create endpoint), multi-firm prepared not built (norm 1 account = 1 firm). Build order: F-A (header) → F-B (inline firm) → M-0..M-3 (machining; M-0/M-1 are migrations → explicit approval). Start each phase only on Nikola's go.

- **Optimization pass (July 2026, after the four-agent health audit)** — implemented across the stack:
  - **Images**: every uploaded photo is recompressed at upload (`optimizeAttachmentImage`, max 2048px/q80 — only optimized bytes are stored); download endpoint gained `?variant=thumbnail` (grids use it via `buildAttachmentThumbnailUrl`), ETag from `content_sha256` + `Cache-Control: private, max-age=86400` for inline images (304 revalidation; documents stay no-store), and file bodies now STREAM (`storage.readStream`). One-off `pnpm --filter api recompress-attachments` (dry-run; `-- --apply`) recompresses pre-existing photos.
  - **API**: global `requestBodyLimit` (2 MB default / 130 MB upload paths — throws 413 before buffering); `ClaimReportPdfRenderer` in the container (ONE shared Chromium, new context per render, 2-slot cap, disposed on shutdown + in tests); claims list count+page run in `Promise.all`; event bus `setMaxListeners(0)`; `/health` excluded from request logs.
  - **DB (migration `0022_elite_franklin_richards`, proven migrate-from-zero)**: `idx_audit_log_created_at_id`, `idx_audit_log_entity_type_created_at`, fault-table `external_party_id` indexes, and ALIGNED full-text search — `idx_emotive_claims_search_fts` (warranty+mr_number), `idx_domace_claims_search_fts` (warranty+mr_number+customer_name), `idx_customers_name_fts`; repository expressions must stay TEXTUALLY identical to these (unified search matches customers via an indexed semi-join). Statistics: emotive anchor uses raw `date_of_claim` (NOT NULL), resolved-range compares the raw timestamptz column (no `::date` cast) — index-friendly, semantics unchanged.
  - **Frontends**: pathless `_shell` layout routes in internal/admin (shell + SSE stream survive navigations; admin role guard hoisted); `defaultPreloadDelay: 100` everywhere; claim-detail reference prefetch is fire-and-forget; recharts split out of the internal entry (269→143 KB gz); logo = one theme-appropriate 512px img (~37 KB, was ~1 MB both variants); claim-report editor serializes on a 300 ms quiet window with blur/unmount flush + memoized EditorContext; capture-flag listener leak fixed.
  - **Hygiene**: turbo outputs corrected (no more warnings; `test:integration` uncacheable; `lint` depends on `^build`; `@mr/tailwind-preset` has a build stub so token changes bust dependent caches — the old stale-CSS pain), `*.zip` gitignored, zod aligned to 4.4.2 everywhere, dead code removed (incl. 33 dead i18n keys), `formatFieldError` + `createAppQueryClient` deduped into `@mr/shared`.
  - **Deliberately NOT done**: `locale.ts`/`theme.ts`/`user-menu` per-app copies (stable duplication, hoist later), keyset pagination for claims, domace anchor expression index, Serbian FTS stemmer, Brandbook PDF git-history rewrite. (Note: permission resolution IS cached — `cachedByRoles`, 5-min TTL keyed by sorted role codes; the residual per-request cost is Better-Auth session validation + one indexed roles lookup, an accepted tradeoff, not an open item.)

- **Portal v2 redesign ("Precision Engineering", July 2026)** — implemented from `design_handoff_client_portal` (zip in repo root; README = spec, `MR Portal v2.dc.html` = authoritative desktop reference). Key facts:
  - Screens: login/register (split hero + marquee), `/pending` (after signup AND on pending login), welcome (hero-misa), dashboard (`/claims` = stats + filter + 2-col cards + activity/support rail), detail (`/claims/$id` = timeline, basics, inspection, photos+lightbox, PDF popup viewer, technician card).
  - Tokens: portal-scoped `--mrp-*` vars in `apps/portal-web/src/styles/globals.css` (dark default + `.light` on `<html>`); theme persisted in localStorage (`mrr:portal:theme`) with a pre-paint bootstrap script; **portal default locale = EN** (`syncPortalRequestLocale` + `PORTAL_LOCALE_BOOTSTRAP_SCRIPT` in `@mr/i18n` — cookie wins, Accept-Language deliberately ignored).
  - Server-derived 3-phase status: as of 2026-07-05 (superseded 2026-07-18, see the client-visibility Phase 2 invariant in §2) this was a pure function of `outcome` — `deriveClientClaimPhase(outcome)`: pending → `in_progress`, resolved → `outcome`. The redundant `progressPhase` wire field was REMOVED then — the portal read status from `outcome` via the same shared function (no client-side re-derivation). Phase 2 re-introduced a wire field (`clientPhase`, now a function of `outcome` **plus** `clientVisibleAt`/`publishedAt`, not outcome alone) because the portal must no longer see the real outcome before publish; `ClientClaimPhase.Received` (Primljeno) is now a live, non-clickable stage, not just a static timeline step. Detail also exposes `employeeName` (approved 2026-07-03). `GET /api/dashboard/client-summary` (phase counts + audit-projected activity feed, own-customer scoped, visibility-aware since Phase 2). Client PDF: `GET /api/claim-reports/export/client/pdf` (`export.own_claims`, 404 for non-owned, also 404 while Primljeno) + in-app iframe viewer.
  - Service filter (All | Engine remanufacture | Machining) is prepared UI: everything renders as engine remanufacture until machining claims exist internally (`claimServiceType()` in portal is the single point to wire the real field later).
  - Support emails: `SUPPORT_EMAIL_BY_KIND` (EMOTIVE → claims@mrgroup.rs, DOMACE → reklamacije@mrgroup.rs), phone +381 11 344 5566 static (`@mr/shared/constants/support-contact.ts`).
  - Deliberately NOT built: forgot-password link (no reset flow exists — needs its own approved task), red primary buttons (forbidden by brandbook), client claim creation.

- `fix(db)`: backfill integration test now seeds permissions before roles → `test:integration` green & order-independent.
- `perf(db)`: migration **0018** added indexes on `emotive_claim_faults` & `domace_claim_faults` `claim_id` / `employee_id` / `department_id` (proved clean migrate-from-zero; EXPLAIN shows index scan).
- `refactor(admin)`: user role/status badges routed through `mr-*` tokens + `BADGE_SHELL_CLASSES`; added **`mr-accent`** (teal) as the 6th hue for the client role; domace success box → `mr-success`; documented in `docs/09` + `docs/15`.

**Open (from the health audit — not yet approved/done):**

- nice-to-have: `~117 @ts-nocheck` in vendored TipTap components (confirmed **leave as-is**). The few remaining `any`/`eslint-disable` in internal-web are vendored TipTap support hooks (`use-throttled-callback.ts`, `use-unmount.ts` — already `@ts-nocheck`'d), **not our code** — `api`/`shared`/`admin-web` are `any`-free.
- attachment signing secret: code now reads `env.ATTACHMENT_SIGNING_SECRET` with fallback to `BETTER_AUTH_SECRET` (so behaviour is unchanged until set). **To activate defense-in-depth, Nikola must add `ATTACHMENT_SIGNING_SECRET` (≥32 chars) to the API env** — introducing/rotating it invalidates outstanding signed URLs (5-min TTL, negligible). (`turbo.json` web-output cache miss resolved in commit `e611738`.)
- Roadmap: project is past Phase 0/1 foundations; admin user/role management is in active build (Phase 3 territory). Custom outcomes are explicitly a **Phase 2 big project** (6-place hardcoding) — don't start casually.

---

_Keep this file current: when a rule changes or drift is resolved, update the relevant section here in the same change._
