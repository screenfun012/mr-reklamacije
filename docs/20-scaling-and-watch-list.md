# docs/20 — Scaling & the data-growth watch-list

> **Status: REFERENCE (2026-07-16).** Written at Nikola's request so that *when do we
> optimize what* lives on paper, not in someone's head. This is a small internal
> warranty-claims system — 3 SPAs (admin/internal/portal) + 1 API (Hono/Node) + 1
> Postgres + MinIO, on Railway; a handful of internal users plus external portal
> clients; a few hundred claims today. **It is far from any scaling limit.** Nothing
> here is a fire — it is a map of *triggers* so we act deliberately, and only when a
> real threshold is actually crossed.

---

## TL;DR

- **You do not need to scale today.** A single API instance + single Postgres handles
  many multiples of current load without any change.
- **"Future-proofing" = knowing the triggers (this doc) + keeping the swap-ready
  interfaces we already have.** It is NOT building capacity we don't need — that is
  just complexity with no payoff.
- **Order you'll actually reach for levers:** vertical bump → data-growth
  optimizations (the watch-list) → storage resize → (only if ever) horizontal.
- The single genuinely *architectural* step is going to **2+ API instances**, and it
  needs exactly two things (Redis for the rate-limit/lockout store + a shared SSE
  pub/sub). Everything else is already horizontal-friendly (see §4). Don't build it
  until there's a concrete trigger.

---

## 1. Do-now cheap win (its own migration — do carefully, like 0025)

**`created_at` index on `emotive_claims` and `domace_claims`.** The dashboard reads
recent claims ordered by `created_at` (`dashboard.repository.ts` `fetchRecent`) and
filters a date range on it (`fetchChart`), but neither table has an index on
`created_at`. At a few hundred rows this is a cheap sequential scan; it only matters as
the tables grow, but the index is trivial and future-proof.

- **Action:** generate a migration (drizzle-kit, never hand-written) adding
  `idx_emotive_claims_created_at` + `idx_domace_claims_created_at`; prove clean
  migrate-from-zero; confirm it's only the intended DDL. ⚠️ **Migration → explicit
  approval + the careful process** (verify journal → generate → migrate-from-zero on a
  fresh DB → show SQL → deploy applies via Railway preDeploy `db:migrate:deploy`).
- **Effort:** S. Not urgent, but cheap and aligned with "do it once, properly."

---

## 2. The watch-list — data-growth items (document now, optimize on trigger)

Each item is *fine today* and becomes worth optimizing only when the data crosses a
threshold. Do **not** pre-optimize; act when the trigger fires. Reference by
file + function (line numbers drift — grep the function).

| # | What / where | Why it's fine now | Trigger (act when…) | Fix when triggered |
|---|---|---|---|---|
| W1 | **`COUNT(*)` over a UNION on every `/api/claims`** — `claims.repository.ts` unified `list()` counts the full emotive∪domace union each page load | Union count over a few hundred rows is sub-ms | Claims ≳ **50k** and the list feels slow / count dominates the query | Cache the total (short TTL) or switch to keyset pagination that doesn't need an exact count; approximate count (`reltuples`) for page 2+ |
| W2 | **Dashboard + statistics full-table aggregates, no cache** — `dashboard.repository.ts` + `statistics.service.ts` run ~9 aggregate queries per load over the whole claims tables | Full-table aggregates over hundreds of rows are fast | Claims ≳ **50k–100k** and dashboard/statistics load feels heavy under concurrent users | Add a short-TTL cache (per-instance in-memory is fine, or Redis if multi-instance) keyed by filter+period; or a nightly rollup table |
| W3 | **Excel export loads all rows into memory (no LIMIT)** — `excel.repository.ts` streams every matching claim into an ExcelJS workbook | A few hundred rows is a small workbook | Export set ≳ **20k–50k** rows → memory spike / slow export | Stream rows in batches into ExcelJS; or cap + paginate the export; or generate off the request path (job) |
| W4 | **Users list fetches ALL pages client-side** — `users-page.tsx` `fetchAllReferencePages` (50/page, serial) | Team is small (tens of users) | Users ≳ **~500** → many serial round-trips on the admin Users screen | Server-side pagination + search (mirror the claims list pattern); or parallelize the reference-page fetch |
| W5 | **DOMACE list anchor uses `COALESCE(...)` with no expression index** — the domace list/anchor ordering computes a COALESCE that can't use a plain column index | Small tables scan fast | Domace claims ≳ **50k** and domace list ordering feels slow | Add an expression index matching the COALESCE anchor (must stay textually identical to the query) |
| W6 | **Reference-page fetch is serial (50/page)** — several admin screens page through reference data one request at a time | Catalogs are small (tens–low hundreds) | Any catalog grows into the **thousands** | Server-side pagination/search, or parallel page fetch |

> **Rule of thumb:** none of these matter below ~**10k** rows in the relevant table, and
> most only above ~**50k**. At current growth that's years away. Revisit this list when
> any core table (emotive_claims, domace_claims) crosses **10k** — that's the first
> "start paying attention" mark.

---

## 3. Scaling ladder — triggers & actions

Reach for these **in order**. Stop at the first rung that solves the problem.

### 3.1 Vertical (bigger box) — first resort
- **Trigger:** CPU or RAM pressure on the API (most likely from PDF export / Chromium),
  or Postgres CPU/IO pressure.
- **Action:** bump the Railway resource limits (slider). API is already at a generous
  24 vCPU / 24 GB (chosen so PDF export can't OOM). Postgres can be bumped the same way.
- **Cost/risk:** trivial, no code change. **This covers you for a very long time.**

### 3.2 Data-growth optimizations = the watch-list (§2)
- **Trigger:** a core table crosses ~10k–50k rows and a specific screen feels slow.
- **Action:** apply the specific fix from §2 for the screen that's actually slow —
  measured, not speculative. Add indexes / caching / pagination as needed.
- **Cost/risk:** low–medium, per-item. Deliberate, one at a time.

### 3.3 Storage (attachments / MinIO)
- **Trigger:** the MinIO volume fills up (today ~1.2 GB used of 50 GB).
- **Action:** Railway live-resize the `bucket-volume` (no downtime); if it ever grows
  huge, move the bucket to managed S3 / Cloudflare R2 (the S3 adapter already speaks the
  S3 API — see docs/17). **Separate axis from the API/DB.**
- **Cost/risk:** trivial for a resize.

### 3.4 Horizontal (2+ API instances) — the only real architectural step
- **Trigger:** you need **high availability** (redundancy / zero-downtime deploys), OR a
  single instance genuinely can't keep up (not expected at this app's load).
- **What it requires** — two pieces of state are currently **in-memory per instance**:
  1. **Rate-limit / login-lockout store** (`packages/auth/src/login-attempt-store.ts` +
     the Hono `loginRateLimiter`). **Already behind an interface → swap to a shared
     Redis store.** This was the deliberate design (see the auth notes: "swap when a
     second instance exists").
  2. **SSE event bus** (`InProcessEventBus`) — a claim updated on instance A would not
     notify SSE clients connected to instance B. Needs a **shared pub/sub**: Redis
     pub/sub, or **Postgres `LISTEN/NOTIFY`** (no new dependency — attractive since we
     already have Postgres). SSE payloads are already signal-only (type+kind+id), so the
     fan-out is small and the pattern ports cleanly.
- **What already works across instances (do NOT undo — see §4):** sessions (in
  Postgres), attachments (MinIO/S3), the stateless request path.
- **Cost/risk:** medium, bounded, well-understood. Adds **one dependency (Redis)** OR
  uses Postgres LISTEN/NOTIFY for SSE + Redis only for the rate-limit store. **Do not
  start without a concrete trigger.**

### 3.5 Database read replica / connection pooler
- **Trigger:** read-heavy load that a bigger single Postgres can't serve (not our
  profile — we're neither read-heavy nor traffic-bound).
- **Action:** Railway read replica for reporting/analytics reads; PgBouncer only if
  many instances exhaust connections (single instance uses pool max 10 — nowhere near).
- **Cost/risk:** medium. **Almost certainly never needed for this app.**

---

## 4. Already scaling-friendly (deliberate — don't undo these)

- **Sessions live in Postgres** (Better-Auth DB sessions) → they work across API
  instances with no sticky-session/load-balancer affinity. *(This is exactly why
  session cookies beat JWT for us — instant server-side revocation AND multi-instance
  friendliness for free.)*
- **Attachments go through MinIO/S3** (shared object store), streamed via the API →
  shared across instances; no local disk state.
- **Rate-limit / login-lockout store is behind an interface** → Redis swap is a drop-in
  when a second instance appears.
- **SSE is signal-only** (never payloads; client re-fetches via `invalidateQueries`) →
  small, portable fan-out; ready for a shared pub/sub.
- **API is effectively stateless** (DI container, no module-level mutable globals) apart
  from the two in-memory stores named in §3.4 — both intentional and both swap-ready.
- **Permission resolution is cached per-instance** (`cachedByRoles`, 5-min TTL). Each
  instance caches independently; a role change is picked up within the TTL (and session
  revocation forces a fresh read for the security-critical case). Accepted tradeoff —
  fine multi-instance.

---

## Bottom line

For this app's size, the honest answer is: **don't scale horizontally; vertical +
the §2 watch-list carry you for years.** The real "future-proof" work is (1) this
document, (2) doing the cheap `created_at` index (§1) when we do the next migration,
and (3) keeping the Redis-swap-ready interfaces. Build horizontal capacity only when a
concrete trigger from §3.4 actually fires.
