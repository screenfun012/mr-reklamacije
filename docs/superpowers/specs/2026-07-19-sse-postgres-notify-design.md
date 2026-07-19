# Replica-safe SSE via Postgres LISTEN/NOTIFY (design)

> Roadmap item ①, Theme 1 ("scaling foundations / cheap insurance now"), see the
> `scaling-stack-qol-roadmap-2026-07-18` memory. Today the realtime layer is an in-memory
> `EventEmitter` bound to ONE API process: a claim mutated on replica A never reaches an SSE client
> connected to replica B. That ties the API to a single replica and briefly breaks realtime during
> every rolling deploy (old + new instance overlap). This makes the code **replica-safe** by swapping
> the in-memory transport for Postgres `LISTEN/NOTIFY` — using the Postgres we already run, **no new
> service**. Scope confirmed with Nikola 2026-07-19: make the code safe, **keep `numReplicas = 1`**
> (turning on a 2nd replica stays a separate, later cost decision). Design approved 2026-07-19.

## 1. Goals

1. **Replica-safe realtime:** any API replica can serve any SSE connection; an event published on one
   replica reaches SSE clients on every replica. Removes SSE as a single-replica blocker and enables
   zero-downtime rolling deploys (the brief old+new instance overlap no longer drops realtime), using the
   Postgres we already run — no new service or recurring cost. **This does NOT by itself make
   `numReplicas > 1` safe:** the in-memory, per-process rate limiter
   (`apps/api/src/core/middleware/rate-limit.ts` — `const buckets = new Map()`) still fragments across
   replicas, so the effective per-IP/per-user limit would multiply by replica count (weakening a security
   control). Steady-state multi-replica stays blocked on that separate concern (`docs/19` ties both);
   `numReplicas` stays 1 per scope.
2. **Zero behavior change for consumers:** services keep calling the same `EventBus` methods; the SSE
   controller keeps calling `subscribeUser`; the frontend is untouched (it already just
   `invalidateQueries` on any event — transport-agnostic).
3. **Same delivery contract:** signal-only, best-effort, at-most-once — exactly today's SSE semantics.
   The server stays the single source of truth; a missed signal is covered by client
   reconnect + refetch, as now.

**Non-goals (explicit YAGNI):** guaranteed delivery, event replay / `Last-Event-ID`, an outbox table,
dedupe, Redis, any change to `numReplicas`/`railway.json`, any change to event payload shapes or the
frontend. No new permission, no migration, no new dependency (`pg` is already installed and speaks
`LISTEN/NOTIFY` natively).

## 2. Current state (verified 2026-07-19)

- `EventBus` port (`apps/api/src/core/ports/event-bus-port.ts`) — 5 publish methods
  (`publishClaimCreated/Updated/Deleted`, `publishResourceChanged`, `publishClientSubmissionChanged`)
  + `subscribeUser`. This is the ONLY surface production code uses.
- `InProcessEventBus` (`.../modules/events/in-process-event-bus.ts`) — an `EventEmitter` hub with
  channel routing: claim events fan out to `role:{operator,viewer,admin}` channels + the owning
  `customer:{id}` channel; resource/submission events fan out to internal role channels; `subscribeUser`
  registers a listener on the user + role (+ customer) channels. `setMaxListeners(0)`.
- `sse.controller.ts` — one SSE connection per user calls `eventBus.subscribeUser(userId, roles,
  listener, customerIds)`, writes each event to the stream, 20 s heartbeat, 30-min lifetime cap.
- Wiring: `buildContainer(..., eventBus: EventBus = new InProcessEventBus())`; tests go through
  `buildTestContainer` → `buildContainer`. **Most** integration suites rely on `buildContainer`'s default
  `new InProcessEventBus()` (they call `buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)` with no
  `eventBus` arg — statistics, claim-sources, engine-types, external-parties, claim-reports, excel,
  departments, audit-log, attachments, employees, sse.http, …; some others inject their own
  `RecordingEventBus`/`InProcessEventBus`). The swap is test-safe **because only `createContainer` (the
  prod entrypoint) changes and `buildContainer`'s default param stays `new InProcessEventBus()`** (§6.4) —
  no test path constructs `PostgresEventBus`. ⚠️ **Do NOT change `buildContainer`'s default** to
  `PostgresEventBus`; that would break the ~25 default-relying suites.
- `createContainer(env, logger)` (prod entrypoint) → `createDb(env)` → `buildContainer(...)` with the
  default bus. `server.ts` holds `container` + `pool` and has a `SIGTERM/SIGINT` `shutdown()` that
  disposes the PDF renderer then `pool.end()`.
- `server.ts:16-23` already logs a warning when `API_REPLICA_COUNT > 1` saying "swap InProcessEventBus
  for Postgres LISTEN/NOTIFY or Redis before scaling." This task makes the SSE-specific part false, but
  multi-replica stays unsafe (the in-memory rate limiter fragments at >1 replica — `docs/19` ties both),
  so the warning is **reworded to point at the rate limiter, not removed** (see §6).
- No production code depends on the concrete `InProcessEventBus` (its extra `publishToUser`/`publishToRole`
  are used only by its own unit test). Grep confirms services call only the 5 interface methods.

## 3. Design — thin Postgres transport wrapping the existing fan-out

A new `PostgresEventBus implements EventBus` **composes** an `InProcessEventBus` (the local fan-out
engine, reused verbatim — untouched, still the test/local double) and adds a Postgres transport. One
delivery path, no double emit:

- **Publish** (a service calls `publishClaimUpdated(payload, customerId)`): the bus does NOT emit
  locally. It serializes a tagged `NotifyMessage` and fires `SELECT pg_notify('mr_events', $1)` on the
  **pool** (fire-and-forget, best-effort). Nothing else.
- **Receive** (the dedicated LISTEN connection gets a `NOTIFY` — including this replica's own, that is
  standard Postgres self-delivery): parse + validate the payload, then **replay** the matching method
  on the wrapped `InProcessEventBus`, which runs the *existing* channel fan-out. Local SSE subscribers
  (registered via `subscribeUser` → delegated to the same wrapped bus) receive it.
- **Subscribe:** `subscribeUser(...)` delegates straight to the wrapped `InProcessEventBus.subscribeUser`.

Because the wrapped bus is the single source of routing truth, there is no duplicated fan-out logic;
`PostgresEventBus` is only transport + replay. A publish makes one Postgres round-trip before local
clients see it (sub-millisecond on the private network) — the tradeoff for identical local/remote
delivery semantics.

```
service.publishX ──▶ pg_notify('mr_events', msg)  ──▶  Postgres
                                                         │  (broadcast to every LISTENer, all replicas)
                                                         ▼
   replica A LISTEN ─▶ replay ─▶ local InProcessEventBus ─▶ SSE subscribers on A
   replica B LISTEN ─▶ replay ─▶ local InProcessEventBus ─▶ SSE subscribers on B
```

## 4. Message shape, routing, and validation

- **One channel:** `mr_events`. Routing lives in the payload, not in channel names (Postgres channel
  names are limited; one channel is simplest and the wrapped bus already does the fan-out).
- **`NotifyMessage`** — a discriminated union mirroring the 5 publish methods, defined + Zod-validated
  **inside the events module** (API-internal transport; never crosses to the frontend, so it does NOT
  go in `@mr/shared`):
  - `{ kind: 'claimCreated'|'claimUpdated'|'claimDeleted', payload: ClaimEventPayload, customerId?: string | null }`
  - `{ kind: 'resourceChanged', resource: ResourceChangedKey }`
  - `{ kind: 'clientSubmissionChanged', submissionId: string }`
- **Inbound validation (trust boundary, house rule):** `JSON.parse` → `NotifyMessageSchema.safeParse`.
  On failure → log + drop (never throw out of the notification handler). This also makes **rolling-deploy
  version skew** safe: old + new replicas briefly share the channel; an unknown/extra `kind` from the
  other version is safely ignored (a dropped signal → the client refetches slightly later). Keep the
  message shape **additive/stable** across versions for this reason.
- **Size:** payloads are ids + kind (`ClaimEventPayload` = claim kind + id), far under the Postgres
  8000-byte `NOTIFY` limit. No guard needed; a `ponytail:` comment names the ceiling.
- The `switch` on `kind` in replay uses `never`-exhaustiveness (house rule).

## 5. Reliability & lifecycle

- **Delivery contract unchanged:** best-effort, at-most-once. `pg_notify` failure → log + drop (client
  refetches on reconnect/focus, same as today). No persistence/replay.
- **Dedicated LISTEN connection = a standalone `pg.Client`** (its own connection from `DATABASE_URL`),
  NOT a pool checkout — so it never eats one of the pool's 10 query slots and has an independent
  lifecycle. Publishing uses the existing pool.
- **Reconnect (kept — baseline correctness, not gold-plating):** if the LISTEN client errors or the
  connection ends (Postgres restart, network blip), a dropped connection would silently kill realtime for
  the whole replica until process restart. **All reconnects route through ONE guarded entry point** — a
  single `reconnecting` boolean that the `'error'` handler, the `'end'` handler, AND a rejected `connect()`
  all call; it no-ops if a reconnect is already scheduled or in flight, and short-circuits on the
  `stopped` (shutdown) flag. This guard is **required**: a real disconnect (Railway restart / FATAL 57P01
  / ECONNRESET) makes a standalone `pg.Client` emit **both** `'error'` and `'end'` for the same drop —
  two unguarded handlers would schedule two backoff timers → two live LISTEN clients, doubling NOTIFY
  replay and leaking one connection per drop (compounding across restarts toward `max_connections`).
  **Attach the `'error'` listener BEFORE `connect()`** — an unhandled `'error'` on a `pg.Client` is a Node
  EventEmitter throw → process crash. Reconnect uses exponential backoff (capped, `unref`'d timer) and
  re-issues `LISTEN`; on success it clears the `reconnecting` flag. Signals during the reconnect gap are
  missed — identical to a client being briefly disconnected. A `ponytail:` comment names this ceiling.
- **Transaction timing:** services publish AFTER their repo write has committed (as today — the current
  in-memory emit is also post-write). `pg_notify` runs on a separate pool connection in autocommit, so
  it delivers immediately and is not coupled to any open transaction. No lost-notify-on-rollback: the
  write already succeeded before publish is called.
- **Start:** `PostgresEventBus.start()` connects + `LISTEN`s. `createContainer` (prod) fires it
  **fire-and-forget** (`void bus.start()`) so boot stays synchronous and a not-yet-ready DB is handled
  by the reconnect loop rather than blocking startup; there are no SSE clients at boot anyway. `start()`
  returns a `Promise` that resolves once the first `LISTEN` is established so **tests can `await`** it
  before publishing. `start()` lives on the concrete class (called where `createContainer` has the
  concrete type), not on the `EventBus` interface.
- **Shutdown:** add optional `dispose?(): Promise<void>` to the `EventBus` port; `PostgresEventBus.dispose`
  sets a `stopped` flag (so the reconnect loop won't fight shutdown) and `end()`s the client.
  `server.ts` `shutdown()` calls `await container.eventBus.dispose?.()` before `pool.end()`.
  `NoOpEventBus`/`InProcessEventBus` don't implement it (optional → skipped).

## 6. Wiring / files touched (surgical)

1. **NEW** `apps/api/src/modules/events/postgres-event-bus.ts` — the class, the `NotifyMessage` union +
   Zod schema, and the inline dedicated-client + reconnect (~80–110 lines, one file). Reconnect is a
   single `reconnecting`-guarded entry point that `'error'`, `'end'`, and a failed `connect()` all funnel
   through (see §5); the `'error'` listener is attached before `connect()`.
2. `apps/api/src/modules/events/index.ts` — export `PostgresEventBus`.
3. `apps/api/src/core/ports/event-bus-port.ts` — add optional `dispose?(): Promise<void>`; update the
   doc comment (drop "multi-instance needs Redis — out of scope"; state Postgres NOTIFY is the transport).
4. `apps/api/src/core/container.ts` — `createContainer` constructs `PostgresEventBus(pool, env.DATABASE_URL,
   logger)`, calls `void eventBus.start()`, and passes it to `buildContainer`. **`buildContainer`'s
   default param stays `new InProcessEventBus()`** → every test path unchanged.
5. `apps/api/src/server.ts` — **reword** (do NOT remove) the `API_REPLICA_COUNT > 1` warning so it names
   the still-in-memory rate limiter as the remaining multi-replica blocker instead of SSE (e.g. "Multiple
   API replicas: the in-memory rate limiter (rate-limit.ts) fragments per process — the effective limit
   multiplies by replica count. Move it to a shared store before scaling."). This keeps the only in-code
   guardrail against unsafe scaling (`docs/19` still warrants it) and keeps `API_REPLICA_COUNT` used → no
   dangling-env-var decision. Also add `await container.eventBus.dispose?.()` in `shutdown()` before
   `pool.end()`.
6. **NEW** `apps/api/src/modules/events/__tests__/postgres-event-bus.integration.test.ts`.
7. Docs: add a §9 "recent work" entry to CLAUDE.md — the §2 "SSE = signal only" note needs **no** change
   (its signal-only/at-most-once semantics are unchanged and it makes no single-process/Redis claim;
   optionally add one line that the transport is now Postgres LISTEN/NOTIFY). Update
   `docs/05-auth-realtime.md`'s "### Event bus architecture" section ("In-process EventEmitter-based
   pub/sub. One instance per API process." + its stale code snippet) to describe the LISTEN/NOTIFY
   transport. **Do NOT** edit docs/05's "### Caching strategy" note ("single API instance … Postgres
   NOTIFY/Redis") — that is about the permission LRU cache, a separate concern this task does not address.
   The `EventBus` port comment is already covered by §6.3. Refresh the roadmap memory.

Frontend: **zero changes.** No migration, no new table, no new dependency, no new permission, no env var.

## 7. Security / correctness invariants

- **No new leak.** The `NOTIFY` payload carries only `kind + id(s)` (+ `customerId` for routing) — the
  same signal-only data the in-memory bus already fanned out. Per-user delivery gating is unchanged: it
  still happens in `subscribeUser`'s channel membership (a client only listens on their own user + their
  customers' channels), so a client still receives signals for their own claims only. Every replica
  "hearing" every event is identical to today's single process hearing every event; the gate is at
  delivery, not at the bus.
- Inbound payloads are Zod-validated before replay; a malformed or foreign `NOTIFY` on the channel is
  dropped, never thrown.
- `pg_notify` is called parameterized (`SELECT pg_notify($1, $2)`) — never string-interpolated (house
  rule: no `sql.raw` with dynamic input).

## 8. Testing

- **New integration test (real Postgres, per house rule — no mocking the DB):** construct **two**
  `PostgresEventBus` instances over the same test DB (= two replicas). `await start()` both. Subscribe a
  listener on instance B; publish `publishResourceChanged` (simplest — no `customerId`) on instance A;
  assert B's listener fires (cross-instance delivery) AND A's own subscriber fires (loopback). Await
  delivery via a promise-with-timeout (real async IO — no fake timers). `dispose()` both in teardown so
  no LISTEN connection leaks into the shared test DB. One event kind is enough: replay just calls the
  already-tested `InProcessEventBus` methods, so the fan-out itself is NOT re-tested here.
- Existing `InProcessEventBus` unit tests and all service/integration tests are **untouched** (they
  inject their own bus). No new migrate-from-zero (no schema change).
- Optionally assert malformed-payload safety: a `NOTIFY` with garbage on the channel is dropped, no throw.

## 9. Build order (subagent-driven, each implementer → reviewer → fix)

1. `PostgresEventBus` + `NotifyMessage` Zod schema + reconnect (the one new file) + module export.
2. `EventBus` port `dispose?()` + doc comment; `createContainer` swap + `start()`; `server.ts` shutdown
   `dispose()` + remove the obsolete warning (+ `API_REPLICA_COUNT` cleanup decision).
3. Integration test (two instances: cross-delivery + loopback + teardown).
4. Docs (CLAUDE.md §2/§9, port comment, `docs/05`) + roadmap memory + full gate.

Full gate green before commit. No prod migration/seed. Land in an isolated worktree, fast-forward onto
`main` (as prior phases) — Nikola pushes.
