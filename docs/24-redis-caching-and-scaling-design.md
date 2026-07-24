# 24 — Redis: caching (relieve now) + scaling readiness

> Status: **PROPOSAL / for review** (2026-07-24). No code written yet.
> Owner decision: option **C** — use Redis to relieve current DB load *and* prepare for
> horizontal scaling, **rationally** (only where it earns its keep, never a new point of failure).

## 1. Goal

Redis is provisioned on Railway but **not connected to any code**. Put it to work the smart way:

1. **Relieve now** — cache the two heaviest server reads (statistics, dashboard) so the DB stops
   re-running 11+ aggregate queries on every page open.
2. **Be ready to scale** — move the two pieces of per-process state that block `numReplicas > 1`
   (rate limiter, login-lockout) into Redis so we *can* run multiple API replicas later.
3. **Optionally** — cache session validation (the single most frequent DB read: one lookup per
   request) via Better-Auth's `secondaryStorage`. Bigger relief, but auth-touching → its own phase.

## 2. Confirmed facts (Railway, verified 2026-07-24)

- **Topology:** Redis lives in the **same project** (`beneficial-enjoyment`) and **same environment**
  (`production`) as `api`, the three web apps, Postgres and MinIO. So **private networking is available**.
- **Private traffic is free:** *"Internal traffic doesn't count toward egress billing"*
  (docs.railway.com/networking/private-networking/how-it-works). API↔Redis over the internal host
  (`redis.railway.internal`) costs **$0** in bandwidth, at any volume.
- **The only bandwidth trap:** connecting via the **public TCP proxy** bills egress at **$0.05/GB**
  (docs.railway.com/databases/redis). We must connect over the **private URL only**.
- **Compute billing:** per-minute on actual usage — RAM **$10/GB/mo**, vCPU **$20/mo**, egress $0.05/GB.
  Our footprint (counters + small JSON + short TTLs) is ~50–150 MB RAM, ~0 idle CPU → a few $/month,
  most likely absorbed by the existing Pro plan credit.

## 3. Guiding principles (non-negotiable)

1. **Redis is optional and degrades gracefully.** `REDIS_URL` absent → the app behaves exactly as
   today (in-memory fallbacks everywhere). Redis down at runtime → cache misses fall through to the
   DB; rate-limit/lockout fall back to the in-process store. **Redis must never become a new single
   point of failure.**
2. **Private URL only.** Wire the internal `redis.railway.internal` host, never the public TCP proxy.
3. **Small footprint.** Only counters + small JSON, always with a TTL. No large blobs, no unbounded keys.
4. **Don't duplicate what Postgres already does.** SSE (LISTEN/NOTIFY) and presence stay on Postgres.
5. **Tests never require Redis.** In-memory implementations remain the default in `buildContainer`,
   so the whole existing test suite runs unchanged.

## 4. Scope — what Redis will and won't do

| Area | Decision | Why |
| --- | --- | --- |
| Statistics summary cache | ✅ Phase 1 | 11 parallel aggregates, no cache, 10-conn pool pressure |
| Dashboard summary cache | ✅ Phase 1 | 4 parallel aggregates, global, ~2 scope variants |
| Rate limiter → shared store | ✅ Phase 3 | in-memory `Map` multiplies limits by replica count |
| Login-lockout → shared store | ✅ Phase 3 | same; already behind a `LoginAttemptStore` interface |
| Session validation cache | ✅ Phase 2 (careful) | highest-frequency DB read (1/req); auth-touching |
| Permission cache cross-replica | ➖ optional, low value | 5-min staleness already accepted (`docs/20`) |
| SSE / presence | ❌ never | already replica-safe via Postgres LISTEN/NOTIFY |
| Reference data (catalogs) | ❌ never | already cached `Infinity` client-side |
| Sessions as source of truth | ❌ never | stays in Postgres; Redis only caches |

## 5. Phases

Each phase: small diff → full gate → owner verifies → commit. Nothing connected before review.

### Phase 0 — Foundation (Redis client + wiring)

- **Env:** add `REDIS_URL: z.string().url().optional()` to `apps/api/src/config/env.ts`
  (mirror the optional-infra pattern of `OPENAI_API_KEY`). Absent = Redis disabled.
- **Client:** one Redis client constructed in `createContainer` (`apps/api/src/core/container.ts`,
  ~L126–131), **beside** the `PostgresEventBus`, using the same shape as
  `apps/api/src/modules/events/postgres-event-bus.ts` (field + lazy connect + single reconnect loop
  with backoff + `dispose()`). Injected via `buildContainer`'s param list with a **null default**, so
  tests and the no-`REDIS_URL` path stay in-process.
- **Library:** `ioredis` (mature, lazy-connect, `maxRetriesPerRequest`/offline-queue controls that make
  graceful degradation easy). One new dependency in `apps/api`.
- **Dispose on shutdown:** `redis.quit()` chained into `server.ts` `shutdown()` (~L96), next to
  `eventBus.dispose()` and `pool.end()`.
- **Cache helper:** a tiny `RedisCache` wrapper — `get<T>(key)`, `set(key, value, ttlSeconds)`,
  `bumpGeneration(name)` — that **no-ops / returns miss when Redis is null or erroring** (try/catch,
  never throws into request paths).
- No behaviour change yet; this phase only makes Redis available.

### Phase 1 — Cache statistics + dashboard (relieve now)

- Wrap `StatisticsService.getSummary` (`statistics.service.ts` L86–144) and
  `DashboardService.getSummary` in a **read-through cache**:
  - **Key:** `stats:{gen}:{scopeKey}:{filtersHash}` (scope = `includeEmotive/includeDomace`; filters =
    year/manufacturer/kind/date-range). Dashboard analogous. **Not per-user** → few keys, high hit rate.
  - **TTL:** short (proposed **60 s**) as a safety backstop.
  - **Invalidation (freshness-preserving):** keep a `stats:gen` integer in Redis; **`INCR` it on any
    claim mutation** (emotive/domace create, update, outcome change, publish). Cache keys embed the
    current `gen`, so one `INCR` instantly orphans all stale entries (they expire via TTL). This keeps
    today's behaviour where stats refresh right after you change a claim — a plain TTL alone would make
    the post-change refresh return stale numbers.
  - **Degradation:** Redis miss/down → compute from DB exactly as today.
- Net effect: repeated opens within the window serve from Redis; the DB stops taking 11 queries per open.

### Phase 2 — Session validation cache (bigger relief; auth-touching)

- Configure Better-Auth `secondaryStorage` (Redis) in `packages/auth` so session lookups hit Redis
  before Postgres. **Postgres stays the source of truth**; Redis is a cache.
- **Care required (this touches auth — explicit approval before coding):**
  - Preserve the current security posture: `cookieCache` stays **disabled**; sign-out / session
    revoke / password / 2FA change must **evict** the Redis entry immediately (Better-Auth does this on
    delete — verify per-path).
  - Short TTL on cached sessions so a revoked session can never outlive it if an eviction is ever missed.
  - Redis down → fall back to the Postgres lookup (no lockout, no login breakage).
- Deferrable: value shows mainly under load; ship only after Phase 1 is proven in production.

### Phase 3 — Shared rate limiter + login-lockout (scaling readiness)

- **Rate limiter** (`apps/api/src/core/middleware/rate-limit.ts`, `buckets` Map L80): add a Redis-backed
  store behind the existing `createRateLimiter` factory using atomic `INCR` + `EXPIRE` (fixed-window).
  **Fallback:** Redis unavailable → the current in-memory bucket (still protects per replica).
- **Login-lockout** (`packages/auth/src/login-attempt-store.ts`): a Redis implementation of the existing
  `LoginAttemptStore` interface — the swap the file was explicitly designed for. Same fallback.
- **Only after this** is it safe to raise `numReplicas > 1`. Flip the replica count in the Railway
  dashboard when ready; update the `server.ts` startup warning accordingly.

## 6. Explicitly out of scope

- Moving sessions out of Postgres. Redis pub/sub for SSE. Presence in Redis (Postgres LISTEN/NOTIFY is
  its stated fix). Server-side caching of reference-data catalogs (already `Infinity` client-side).
- Cross-replica consistency of the permission cache (5-min staleness already accepted, `docs/20`).

## 7. Testing

- `buildContainer` default stays in-process (Redis param defaults to null) → **the entire existing
  suite runs with no Redis and no changes.**
- Add focused unit tests for `RedisCache` (get/set/miss/generation) and the rate-limit/lockout Redis
  stores using a lightweight fake or an integration-gated real Redis (mirroring how the DB is real in
  integration tests). Redis-backed integration tests are opt-in, never required for the default gate.

## 8. Operational / cost notes

- Connect **only** via the private `REDIS_URL` (`redis.railway.internal`) → zero egress.
- Keep everything TTL'd and small → RAM stays tens of MB → a few $/month, likely within plan credit.
- Health check stays a static liveness endpoint; **do not** gate deploys on Redis (it's optional).

## 9. Open items to confirm before implementation

1. **Phase ordering.** Recommended: 0 → 1 (relieve now) → 3 (scaling) → 2 (session cache, once Phase 1
   is proven). Owner may want Phase 2 sooner since it was explicitly requested.
2. **`ioredis`** as the client library (one new dep in `apps/api`).
3. **Statistics/dashboard TTL** (proposed 60 s) and the generation-bump invalidation approach.
4. Confirm we wire the **private** Redis URL variable (not the public proxy) when connecting.
