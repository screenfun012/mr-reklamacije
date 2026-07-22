# docs/22 — Readiness for scope growth

> **Status: REFERENCE (2026-07-22).** Companion to `docs/20-scaling-and-watch-list.md`.
> docs/20 answers *"what breaks as the tables fill up"* — row growth, with triggers
> years away at current volume. This document answers a different question Nikola
> asked: *"what breaks as the app grows in SCOPE"* — machining, assorted forms, a
> warranties section, more client-facing surface. Those are new **modules**, not new
> rows, and docs/20 does not cover them.
>
> Written after a four-track analysis of the deployed system. Every finding below was
> re-verified by hand against the code before being written down; file references are
> the evidence, not decoration.

---

## 0. The three fears, separated

Nikola's question mixed three worries that have three different answers. Keeping them
apart is most of the value here.

| Worry | Where we actually are | When it bites |
| --- | --- | --- |
| **More data** (rows) | ~128 claims, 33 tables | docs/20's triggers start at 20k–50k rows. Years. |
| **More code** (modules/screens) | full build ~17 s, typecheck ~16 s, 561 integration tests in ~37 s; each claim family adds ~1.5–2 KB gzipped of lazily-loaded browser code | The machine does not care. What grows is *decisions repeated per family* and Nikola's own review/translation time (1,000+ Serbian+English keys, he writes the Serbian). |
| **More concurrent people** | **This is the real gap** — see §1.1 | Now, and independent of row count. |

**Machining needs a table, not a database.** Two tables inside the Postgres that already
exists, behind the API that already exists — zero new Railway services, ≈ zero added to
the bill. A separate database would be strictly worse: claims that must be listed,
searched, counted and exported together would live in two places.

---

## 1. Verified findings (do-now candidates)

### 1.1 The connection ceiling is 10, and one screen asks for 12

`packages/db/src/client.ts` creates the pool with `new pg.Pool({ connectionString })` and
no options, so node-postgres defaults apply: **max 10 connections**,
`connectionTimeoutMillis: 0` (**wait forever**), no `statement_timeout`.
`StatisticsService.getSummary` issues **12 repository calls in one `Promise.all`** — one
page load can exhaust the pool by itself.

At 128 rows every query is sub-millisecond, so nothing is felt today. The ceiling is
reached by **concurrency**, not by row count — which is exactly why docs/20's row-based
triggers will never warn about it.

Made worse by the health check: `apps/api/src/routes/health.ts` returns a static
`{ status: 'ok' }` and never touches the database. So a saturated pool means requests
that hang forever, a green Railway healthcheck, no restart, and no alert. The only
detection channel is a phone call.

**✅ DONE 2026-07-22.** `createPool` gained an OPT-IN `PoolTimeouts` argument and the API
runtime (`apps/api/src/infrastructure/db.ts`) passes connection 5 s / statement 30 s /
idle-in-transaction 60 s. Opt-in matters: `migrate-deploy.ts` and the one-off scripts share
that factory, and a statement timeout there would abort a long index build and fail the
deploy. `max` was NOT raised (that moves the bottleneck into Postgres) and `/health` still
does not touch the DB (a flapping healthcheck restarts a container that is merely busy).
Integration tests assert the settings actually reach Postgres (`SHOW statement_timeout`,
plus a `pg_sleep` that must be cancelled) and that the DEFAULT pool stays unlimited so
migrations are never cut off. Slow requests (≥ 1 s) now log at `warn` instead of `info`.

docs/20 §4 called explicit pool options "a deliberate future choice". The choice was made.

### 1.2 Three places assume there are exactly two kinds of claim

```ts
kind === ClaimKind.Emotive ? 'emotive_claims.view' : 'domace_claims.view'
```

- `apps/api/src/modules/claims/claims.controller.ts` — `hasFullViewForKind`, which gates
  **field breadth on every row of the unified `/api/claims` list** (internal fields vs the
  client whitelist)
- `apps/api/src/modules/notifications/notifications.service.ts` — `claimEntityType` and
  `claimViewPermission`
- `packages/shared/src/utils/claim-detail-path.ts` — the detail route

`CLAIM_KIND_BY_KEY` (`packages/shared/src/constants/kind-registry.ts`) is built with an
`as Record<…>` **cast**, so a missing kind compiles silently. There is no `never`
exhaustiveness guard on `ClaimKind` anywhere in the repo — even though the pattern is used
correctly for fault types, MIME types and SSE messages.

**The day a third kind is added it falls into the DOMACE branch:** wrong permission gate,
notifications to the wrong audience, detail links that 404. Typecheck stays green. All 561
integration tests stay green. A person finds it, in production.

**Action (S, ~20 lines):** replace the ternaries with `Record<ClaimKind, …>` maps and build
the registry from a `Record` literal so a missing kind fails the build.
(`KIND_BADGE_CLASSES` in `kind-colors.ts` already does this correctly — copy that shape.)

**This is the one item where waiting converts a 20-line edit into a production permission
bug.**

### 1.3 Backups have never been restored, and the two halves drift

Postgres snapshots and the MinIO bucket snapshots run on **independent** schedules. A
restore therefore pairs a database from one moment with object storage from another:
attachment rows pointing at objects that do not exist in the restored bucket. It does not
surface at restore time — it surfaces weeks later as "photos are missing from old claims".

`docs/11-deployment.md` says "test restore quarterly, document last tested date in admin
wiki". There is no admin wiki, and no restore has been tested.

**Action (M, half a day):** restore both snapshots into a throwaway environment, open three
claims that have photos, confirm the photos load, write the date down.

### 1.4 Nobody has read the actual Railway bill

The only usage figure recorded anywhere is "~$1.23/mo" (memory, 2026-07-12) — a
month-to-date reading taken a few days into a billing cycle, which does not square with six
always-on containers.

Two facts worth stating plainly, because they are easy to get backwards:

- **The api's 24 vCPU / 24 GB is a ceiling, not a reservation.** Railway bills actual
  usage. A high ceiling is not itself expensive; it is there so PDF rendering cannot OOM.
- **A spend hard limit is a kill switch, not a brake.** When it trips, Railway takes
  everything offline — including Postgres — until the next cycle or a manual raise. It
  protects the bill by stopping the business.

**Action (S, 2 minutes of Nikola's time):** read Workspace → Usage; record projected
full-month compute, the per-service split, how volume storage bills, and snapshot
retention cost. Then re-tier: email alert at ~1.5× measured spend, hard limit at 3–4× so
it is a fuse rather than a budget.

---

## 2. Decide before the first machining migration

These are free today and cost a data migration on live rows later. Answers belong in
`docs/16` §6.

### 2.1 Is machining INSIDE the claims list, or BESIDE it? — the big one

**The code and the design doc currently disagree.** `apps/internal-web/src/config/navigation.ts`
ships machining as a top-level `/masinska-obrada` (phase M-P, commit `130d448`), while
`docs/16` §4 says the route tree is `reklamacije/masinska/` and machining becomes a third
branch of the unified list, statistics and Excel.

The ~14 hand-written `UNION ALL` sites are the easy part. What fights is the **row
contract**: `UnifiedListRow` and the `z.discriminatedUnion('kind', …)` in
`packages/shared/src/schemas/claim-list.schema.ts` are EMOTIVE ∪ DOMACE-shaped — warranty
report, MR number, engine type, manufacturer. Machining's anchors are a work-order number
and a part type, and it has none of those. A third branch must either shoehorn machining
into existing columns (silently poisoning the MR duplicate pre-flight and making search
behave differently per family) or widen the contract (rippling into table columns, filters,
the sort whitelist and the client projection).

- **Beside:** ~1,500 lines.
- **Inside:** ~5,500 lines.

**This is a business question, not a technical one:** when a worker opens "Reklamacije",
should head machining appear alongside engine claims, or is it a separate job with its own
list? Nikola decides. If "inside", widen the contract deliberately — never shoehorn.

**Related, and it fails silently:** migration `0022` created aligned full-text indexes whose
expressions must stay **textually identical** to the repository expressions. Machining in the
unified search needs its own aligned index in the same migration, or search degrades to a
sequential scan with no error and no failing test.

### 2.2 Work-order number uniqueness — in the migration that creates the table

`docs/16` §3.2 makes it the anchor and says to treat it like the MR number. The precedent
cost real money: prod `mr_registry` held **3 of 127** numbers, needing an emergency 124-row
backfill and `backfillMrRegistry` bolted onto the importer (CLAUDE.md §9).

Sub-question nobody has asked: **does the work-order number share the `mr_registry`
namespace or get its own table?** That decides whether the existing duplicate pre-flight
works for machining or silently reports nothing.

**Recommendation:** own branch of `mr_registry` (it already has a `claim_kind` column, so it
is a CHECK widening, not a new table), with the pre-flight wired on day one.

### 2.3 Machining's portal visibility — decide before the table exists

`docs/16` §6 question 2 is exactly this and is still open. EMOTIVE's client-visibility model
cost **three migrations** (`0027`, `0028`, `0029`), a new permission with a manual prod seed,
wire masking, a freshness join, per-section markers and a `mark-seen` endpoint.

**Recommendation:** if the answer is "yes, eventually", ship `client_visible_at` and
`published_at` as nullable columns in M-1 and leave them NULL. Two unused columns cost
nothing; retrofitting repeats the whole sequence.

Also decide now that machining gets its **own** Excel export rather than joining the
reklamacije workbook — that workbook is built entirely in heap with no `LIMIT`, and sharing
it halves the time until docs/20's W3 trigger fires.

### 2.4 Satellite tables: how they point at a claim

Four tables carry a hand-written "exactly one of `emotive_claim_id` / `domace_claim_id`"
CHECK plus a `claim_kind` CHECK plus partial indexes plus one FK per kind — `attachments`,
`claim_observations`, `claim_reports`, `mr_registry`.

**Recommendation: keep the pattern.** It fails loudly (a CHECK violation on insert, not
silent corruption) and preserves real referential integrity. The alternative — a single
`claim_kind` + `claim_id` pair — means a data migration on live rows whose attachments
already sit in MinIO. But **write the decision down**, because today it gets made by
whoever generates the migration.

### 2.5 Numbering and soft-delete symmetry

`sequence_number` / `claim_year` are per-family and the unified list sorts on them —
machining needs its own scheme decided up front. Separately, only 7 of 18 schema files carry
`deletedAt`; `notifications`, `claim_reports` and `mr_registry` do not, so a soft-deleted
claim leaves live notification rows pointing at it (they 404 on click today — minor, but
worth a thought before machining becomes a third source of notifications).

---

## 3. Act only when the trigger fires

Triggers Nikola can observe without reading a metric.

| Trigger | Action | Effort |
| --- | --- | --- |
| A statistics/dashboard screen goes on a wall display | Stop the SSE path from invalidating statistics + dashboard on every claim event (`invalidate-internal-claim-queries.ts` fires both today, so one save re-runs the 12-query statistics summary in every open tab) | S |
| Someone says "it logged me out for no reason" | Forward `cf-connecting-ip` in `packages/auth/src/server-session-loader.ts` (today only the cookie is forwarded, so every server-rendered page load across all three apps shares ONE rate-limit bucket), and distinguish "session expired" from "429" from "no answer" in the logs | S |
| More than ~8 people doing data entry | Key the general rate limiter by user id instead of public IP — the whole office NATs to one address | S |
| The PDF export button feels dead when several people export at once | Add a ~30 s timeout to the render semaphore (unbounded queue today; Cloudflare 524s at ~100 s). Do **not** raise the concurrency cap | S |
| Excel export takes > 10 s, or claims pass ~20k | docs/20 W3 — pagination/limits | M |
| The M-1 branch is open | Fold the ~14 `UNION ALL` branches onto `CLAIM_KIND_REGISTRY` **as part of that branch**, plus one test that loops the registry and asserts every kind appears in every aggregate | M |
| Any single action routinely takes > 10 s, or one action emails > 20 people | Move it off the request path — start with the fire-and-settle pattern already used for the outcome email; reach for a job library only if that visibly fails. No Redis | M |
| A performance complaint that cannot be reproduced | Log slow requests and slow queries through the existing pino logger. Not an APM vendor | S |

---

## 4. Not for this app

| Thing | Why not |
| --- | --- |
| A second API replica | Zero-downtime deploys already work (the api has no volume since the MinIO cutover). A replica only buys surviving one instance dying, and costs a shared rate-limit store plus double compute. |
| Redis (cache, queue, or rate-limit store) | A permanently metered service to solve a problem this app does not have. Postgres `LISTEN/NOTIFY` already replaced it for SSE. |
| Read replica / PgBouncer | Not read-bound, not traffic-bound. A single instance uses at most 10 connections. |
| An APM / metrics vendor | Nobody would watch the dashboard. Slow-query logging answers the same question at zero cost. |
| A bundle-size CI gate | The budget it would enforce is an invented number, and it would start by ratifying the breach it exists to catch. |
| A generic "claims framework" | The layer that actually gets edited (repositories) differs meaningfully per family; only never-touched boilerplate is extractable. ~600 genuinely duplicated lines across two more sections is not worth a framework. |

---

## 5. The price of doing nothing

Building machining and warranties exactly the way DOMACE was built, and revisiting in a
year, costs roughly **45–90 files and 5,500–7,500 lines per section** (measured: the
`client-submissions` vertical was 85 files / 10,360 insertions, ~5,590 hand-written; the
total DOMACE footprint is 89 files / 7,488 lines). About 600 of those lines are genuine
duplication — real, but not framework-worthy.

The likely order of what actually goes wrong:

1. **A silent permission bug on machining day** (§1.2) — no test catches it.
2. **A hang under concurrency with a green healthcheck** (§1.1) — undiagnosable without §1.1's timeouts.
3. **A restore that pairs a database with mismatched photos** (§1.3) — discovered weeks after the incident.
4. **A retrofit of client visibility** (§2.3) repeating three migrations and a manual prod seed.

None of these is about row counts. All four are cheap to prevent and expensive to discover.
