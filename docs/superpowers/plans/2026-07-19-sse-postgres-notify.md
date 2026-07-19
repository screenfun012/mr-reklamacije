# Replica-safe SSE via Postgres LISTEN/NOTIFY — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.
> Each Task is one implementer → reviewer → fix loop; the final Task is the full-gate QA.
> **Single source of truth:** `docs/superpowers/specs/2026-07-19-sse-postgres-notify-design.md` (approved 2026-07-19). Do NOT re-decide anything in it — this plan only sequences it into executable steps.

**Goal:** Make the realtime layer replica-safe by swapping the in-memory transport for Postgres `LISTEN/NOTIFY`, using the Postgres we already run — no new service, no new dependency, no migration, no frontend change. Services keep calling the same `EventBus` methods; the SSE controller keeps calling `subscribeUser`; delivery stays signal-only / best-effort / at-most-once.

**Design in one line:** a new `PostgresEventBus implements EventBus` that **composes** an `InProcessEventBus` (local fan-out, reused verbatim) and adds a transport: `publish` = fire-and-forget `SELECT pg_notify('mr_events', $1)` on the pool; `receive` = a dedicated standalone `pg.Client` LISTENing on `mr_events` that parses + Zod-validates each NOTIFY and **replays** the matching method on the wrapped `InProcessEventBus`.

**Scope guardrail:** this makes SSE replica-safe but does NOT flip `numReplicas > 1` — the in-memory rate limiter still fragments per process. `numReplicas` stays 1 (Nikola's scope, 2026-07-19).

**Tech Stack:** Hono + Node, `pg` (already a direct dep, `^8.20.0`, speaks LISTEN/NOTIFY natively), Drizzle, Zod 4.4.2, Vitest + real Postgres.

---

## Global Constraints

- **Isolation:** work happens in an isolated git worktree (superpowers:using-git-worktrees). Full gate green before commit. **Nikola pushes — never `git push`.** Never start/kill the dev servers. No migration/auth touched → no special approval gate.
- **Nothing changes for consumers:** the 5 publish methods + `subscribeUser` keep their signatures; frontend untouched; no new permission, table, dependency, or env var.
- **⚠️ Do NOT change `buildContainer`'s default param** (`eventBus: EventBus = new InProcessEventBus()`). ~25 integration suites rely on the default. ONLY `createContainer` (the prod entrypoint) constructs `PostgresEventBus`.
- **`InProcessEventBus` stays untouched** — it is the reused fan-out engine AND the test/local double. Its existing unit test (`__tests__/in-process-event-bus.test.ts`) stays green, unchanged.
- **House conventions (CI-enforced, non-negotiable):** no semicolons, single quotes, 2-space, trailing commas (Prettier). `any` banned. No `enum` → `as const` + derived type. Explicit return types on public/service methods. Typed domain errors — but here the notification handler **never throws** (log + drop). Zod at the trust boundary (inbound NOTIFY). Parameterized SQL only — `pg_notify($1, $2)`, never `sql.raw`/interpolation with dynamic input. Files kebab-case, one primary export per file. No magic strings — derive Zod literal sets from the shared `ClaimKind` / `ResourceChangedKey` consts; the transport discriminant tags live in one local `as const` map (or inline `z.literal` scoped to the schema file).
- Known pre-existing flakes (CLAUDE.md §8) reproduced on base are NOT gate failures.

---

## Task 1: `PostgresEventBus` — class + `NotifyMessage` Zod schema + reconnect + export

**Files:** NEW `apps/api/src/modules/events/postgres-event-bus.ts`; edit `apps/api/src/modules/events/index.ts`. No test in this task — the class is exercised by the real-Postgres integration test in Task 3 (house rule: no DB mocking).

**Interfaces produced:** `class PostgresEventBus implements EventBus` with `constructor(pool: Pool, databaseUrl: string, logger: Logger)`, the 5 publish methods, `subscribeUser` (delegated), `start(): Promise<void>`, `dispose(): Promise<void>`; plus the module-internal `NotifyMessage` type + `NotifyMessageSchema`.

- [ ] **Step 1 — Read the ground truth.** Re-read `in-process-event-bus.ts` (the 5 publish methods + `subscribeUser` signature you must mirror/delegate to), `event-bus-port.ts` (the interface), the shared event shapes (`packages/shared/src/constants/{claim,resource,client-submission,app}-events.ts`, `enums.ts` `ClaimKind`), and `packages/db/src/client.ts` (`createPool`, `getDatabaseUrl` — the `pg.Pool`/`DATABASE_URL` model). Confirm `pg` is a direct dep (`apps/api/package.json` → `pg: ^8.20.0`) so `import pg from 'pg'` as a **value** is allowed (depcruise-safe).
- [ ] **Step 2 — Define `NotifyMessage` + Zod schema (inside this file — API-internal transport, NOT `@mr/shared`).** A discriminated union on a transport tag `kind` mirroring the 5 publish methods:
  - `{ kind: 'claimCreated' | 'claimUpdated' | 'claimDeleted', payload: ClaimEventPayload, customerId?: string | null }`
  - `{ kind: 'resourceChanged', resource: ResourceChangedKey }`
  - `{ kind: 'clientSubmissionChanged', submissionId: string }`
  - `NotifyMessageSchema = z.discriminatedUnion('kind', [...])`; `payload` = `z.object({ kind: <ClaimKind literals>, id: z.string() })`; `resource` = `<ResourceChangedKey literals>`; `customerId` = `z.string().nullish()`. **Derive the `ClaimKind` / `ResourceChangedKey` literal sets from the shared consts** (no hardcoded engine/kind strings). Export `type NotifyMessage = z.infer<typeof NotifyMessageSchema>`.
  - The transport `kind` tags (`'claimCreated'` …) are NEW and distinct from the existing SSE wire strings (`'claim_created'` = `ClaimEventType.Created`). Keep them local to this file (`const NotifyKind = { ... } as const`, or inline `z.literal`).
- [ ] **Step 3 — The class (composition).** Fields: `private readonly local = new InProcessEventBus()`; `private client: pg.Client | null = null`; `private stopped = false`; `private backoffMs` (start ~250, cap ~10_000); a once-only `startResolve` for the `start()` promise. (No `reconnecting` flag — the single reconnect loop in Step 4 IS the one reconnect path.)
  - **5 publish methods** — do NOT emit locally. Each builds the matching `NotifyMessage`, `JSON.stringify`s it, and calls `void this.notify(msg)` where `notify` runs `this.pool.query('SELECT pg_notify($1, $2)', [CHANNEL, json])` and `.catch(err => this.logger.warn(...))` (fire-and-forget, best-effort — a failed publish is a dropped signal, same contract as today). `CHANNEL = 'mr_events'` (module const). `// ponytail:` comment noting the 8000-byte NOTIFY ceiling (payloads are ids + kind, far under it — no guard).
  - **`subscribeUser(...)`** — one line: `return this.local.subscribeUser(userId, roleCodes, listener, customerIds)`. Same explicit signature/return type as the port.
  - **`start(): Promise<void>`** — kicks the reconnect loop once (`void this.connectLoop()`) and returns a Promise that resolves the first time `LISTEN` is established (so tests can `await`; prod calls it fire-and-forget `void bus.start()`).
  - **`dispose(): Promise<void>`** — set `this.stopped = true`, then `await this.client?.end()` — the current client's `'end'` unblocks the loop, which then sees `stopped` and exits. Explicit return type.
- [ ] **Step 4 — The dedicated LISTEN client as a single self-rescheduling loop (spec §5 — load-bearing; this is the ONE reconnect path).** A `private async connectLoop(): Promise<void>` owns the whole connect → listen → wait-for-drop → backoff → retry cycle, so a disconnect triggers **exactly one** reconnect (no separate `reconnecting` guard, no double-scheduling):
  ```
  while (!this.stopped) {
    const client = new pg.Client({ connectionString: this.databaseUrl })
    const closed = new Promise<void>((resolve) => {
      client.on('error', (err) => { this.logger.warn({ err }, 'listen client error'); resolve() })
      client.on('end', () => resolve())
    })
    client.on('notification', (msg) => this.onNotify(msg))   // Step 5
    try {
      await client.connect()
      await client.query('LISTEN mr_events')
      this.client = client
      this.backoffMs = INITIAL_BACKOFF_MS
      this.startResolve?.()            // resolve start() once
      await closed                     // park here until the connection drops
    } catch (err) {
      this.logger.warn({ err }, 'listen connect failed')
    } finally {
      this.client = null
      await client.end().catch(() => {})
    }
    if (this.stopped) break
    await this.sleep(this.backoffMs)   // unref'd timer
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
  }
  ```
  - **Why this is race-free:** the `'error'` listener is attached **before** `connect()` (an unhandled `'error'` on a `pg.Client` is a Node EventEmitter throw = process crash) — but it only `resolve()`s the local `closed` promise, it does NOT itself schedule a reconnect. A real drop fires BOTH `'error'` and `'end'`; both call `resolve()` on the **same** promise (idempotent), so the loop advances **once** → one `client.end()` → one reconnect. There is no second timer and no leaked client. On a connect-time failure the `catch` handles it and the early `closed`-resolve is harmless (the loop is not parked on `await closed` yet).
  - A NEW `pg.Client` is created per iteration (standalone connection from `DATABASE_URL`, NOT a pool checkout). `INITIAL_BACKOFF_MS`/`MAX_BACKOFF_MS` module consts (~250 / ~10_000). `sleep` uses `setTimeout(...).unref()` so a pending backoff never holds the process open at shutdown. `// ponytail:` comment: signals during the reconnect gap are missed — identical to a briefly-disconnected client; upgrade path = an outbox if guaranteed delivery is ever needed.
- [ ] **Step 5 — Receive → validate → replay.** In the `'notification'` handler: `JSON.parse(msg.payload)` inside try/catch; `NotifyMessageSchema.safeParse(...)`; **on parse OR validation failure → `logger.warn` + return (NEVER throw out of the handler)** — this also makes rolling-deploy version skew safe (an unknown `kind` from the other replica version is dropped). On success, `switch (message.kind)` with `never`-exhaustiveness (house rule) replaying onto `this.local`: `claimCreated/Updated/Deleted` → `this.local.publishClaim*(message.payload, message.customerId)`; `resourceChanged` → `this.local.publishResourceChanged(message.resource)`; `clientSubmissionChanged` → `this.local.publishClientSubmissionChanged(message.submissionId)`.
- [ ] **Step 6 — Export.** `apps/api/src/modules/events/index.ts` → add `export { PostgresEventBus } from './postgres-event-bus.js'`.
- [ ] **Step 7 — Verify:** `pnpm --filter api typecheck && pnpm --filter api lint` clean; `pnpm --filter api test -- in-process-event-bus` still green (proves the reused engine is untouched).
- [ ] **Step 8 — Reviewer → fix loop** (superpowers:requesting-code-review): reviewer checks the single reconnect loop yields exactly one reconnect per drop (`'error'`+`'end'` resolve the same `closed` promise), the `'error'` listener is attached before `connect()`, no local emit in publish, parameterized `pg_notify`, `never`-exhaustive switch, handler never throws, explicit return types, no `any`.
- [ ] **Step 9 — Commit** (only after review): `git add apps/api/src/modules/events && git commit -m "feat(events): PostgresEventBus — LISTEN/NOTIFY transport wrapping the in-process fan-out"`.

---

## Task 2: Wiring — port `dispose?()`, `createContainer` swap + `start()`, `server.ts` shutdown + warning reword

**Depends on:** Task 1 (needs `PostgresEventBus`).

**Files:** `apps/api/src/core/ports/event-bus-port.ts`, `apps/api/src/core/container.ts`, `apps/api/src/server.ts`. (`event-bus.ts` `NoOpEventBus` and `in-process-event-bus.ts` do NOT implement `dispose` — it is optional → skipped.)

- [ ] **Step 1 — Port.** In `event-bus-port.ts`: add `dispose?(): Promise<void>` to the `EventBus` interface. Update the doc comment: drop the stale "Multi-instance deployments need a distributed pub/sub layer (e.g. Redis) — out of scope for Phase 1.1d (single API process)." → state the transport is now Postgres `LISTEN/NOTIFY` (`PostgresEventBus`) in prod; tests inject `InProcessEventBus`/`NoOpEventBus`/`RecordingEventBus`; `dispose?()` ends the LISTEN connection on shutdown.
- [ ] **Step 2 — `createContainer` (prod entrypoint ONLY).** In `container.ts`, change `createContainer`:
  ```
  export function createContainer(env: Env, logger: Logger): Container {
    const { db, pool } = createDb(env)
    const eventBus = new PostgresEventBus(pool, env.DATABASE_URL, logger)
    void eventBus.start()
    return buildContainer(env, logger, db, pool, eventBus)
  }
  ```
  Import `PostgresEventBus` from `../modules/events/index.js`. `void eventBus.start()` = fire-and-forget so boot stays synchronous (a not-yet-ready DB is handled by the reconnect loop; no SSE clients at boot). **Leave `buildContainer`'s default param `= new InProcessEventBus()` exactly as-is** (keep the existing `InProcessEventBus` import). `container.eventBus` stays typed `EventBus` (interface) in the `Container` shape.
- [ ] **Step 3 — `server.ts` shutdown.** In `shutdown()`, before `container.pool.end()`, add `await container.eventBus.dispose?.()` (ends the LISTEN client so it doesn't outlive the pool). Slot it into the existing PDF-renderer-dispose → `pool.end()` chain (dispose the bus alongside/just before the pool close; keep the `SHUTDOWN_FORCE_MS` guard behavior intact).
- [ ] **Step 4 — `server.ts` warning REWORD (do NOT remove — spec §6.5).** Change the `API_REPLICA_COUNT > 1` warning so it names the still-in-memory rate limiter as the remaining multi-replica blocker instead of SSE. E.g.: *"Multiple API replicas: SSE now propagates via Postgres LISTEN/NOTIFY, but the in-memory rate limiter (core/middleware/rate-limit.ts) still fragments per process — the effective per-IP/user limit multiplies by replica count. Move it to a shared store before scaling."* This keeps the only in-code guardrail against unsafe scaling and keeps `API_REPLICA_COUNT` referenced (no dangling-env decision). **Do NOT edit `rate-limit.ts` itself.**
- [ ] **Step 5 — Verify:** `pnpm --filter api typecheck && pnpm --filter api build && pnpm --filter api lint` clean. (Build proves `server.ts`/`container.ts` compile against the concrete `start()`/optional `dispose?()`.) Sanity: `pnpm --filter api test:integration -- claim-sources` still green (a default-`InProcessEventBus` suite is unaffected).
- [ ] **Step 6 — Reviewer → fix loop:** reviewer confirms `buildContainer` default is untouched, `start()` is fire-and-forget, `dispose?.()` is optional-chained + awaited before `pool.end()`, the warning is reworded (not deleted) and points at the rate limiter.
- [ ] **Step 7 — Commit:** `git add apps/api/src/core apps/api/src/server.ts && git commit -m "feat(events): wire PostgresEventBus in createContainer + dispose on shutdown; reword replica warning"`.

---

## Task 3: Integration test — two instances, cross-delivery + loopback + teardown (real Postgres)

**Depends on:** Task 1 (`PostgresEventBus.start()`/`dispose()`).

**Files:** NEW `apps/api/src/modules/events/__tests__/postgres-event-bus.integration.test.ts`.

**Why not the usual test-DB context helper:** this test writes NO table rows — it only needs live, committed, autocommit connections (each bus instance opens its OWN standalone `pg.Client` for `LISTEN`, and publishes via the pool; `LISTEN/NOTIFY` only delivers on committed connections, never inside an open/rolled-back transaction). So connect straight to the `_test` DB: `getIntegrationDatabaseUrl()` + `assertIntegrationDatabase()` + `createPool()` from `@mr/db`. (Per CLAUDE.md §8 the suites isolate via `TRUNCATE`/manual delete, not `BEGIN`/`ROLLBACK` — but isolation is moot here since no rows are written.) No seed / migrate-from-zero concern.

- [ ] **Step 1 — Failing test skeleton.** `beforeAll`: `const url = getIntegrationDatabaseUrl(); assertIntegrationDatabase(url); const pool = createPool(url)`. Construct **two** instances = two replicas: `const a = new PostgresEventBus(pool, url, fakeLogger())`, `const b = new PostgresEventBus(pool, url, fakeLogger())`; `await a.start(); await b.start()`. (Sharing one pool for publish is fine — each instance owns its own standalone LISTEN client.)
- [ ] **Step 2 — Cross-instance delivery + loopback.** Subscribe a listener on **B** (`b.subscribeUser('u1', [SYSTEM_ROLE_OPERATOR], onB)`) and one on **A** (`a.subscribeUser('u2', [SYSTEM_ROLE_OPERATOR], onA)`). Publish the simplest event on **A**: `a.publishResourceChanged(ResourceChangedKey.EngineTypes)` (no `customerId` needed). Await delivery via a **promise-with-timeout** (real async IO — NO fake timers, NO `vi.setSystemTime`): a helper that resolves when the listener fires or rejects after e.g. 2000 ms. Assert **B's** listener fired (cross-instance) AND **A's** fired (loopback self-delivery), each with `{ type: ResourceEventType.Changed, payload: { resource: ResourceChangedKey.EngineTypes } }`. One event kind is enough — replay just calls the already-tested `InProcessEventBus`; do NOT re-test the fan-out here.
- [ ] **Step 3 — (Optional) malformed-payload safety.** Fire a raw garbage NOTIFY on the channel (`await pool.query("SELECT pg_notify('mr_events', 'not json')")` and/or a JSON object with an unknown `kind`) and assert no throw / process stays up and a valid event still delivers afterwards. Keep it lightweight.
- [ ] **Step 4 — Teardown (critical).** `afterAll`: `await a.dispose(); await b.dispose(); await pool.end()`. Disposing BOTH prevents leaked LISTEN connections accumulating in the shared `_test` DB across runs.
- [ ] **Step 5 — Run:** `pnpm --filter api test:integration -- postgres-event-bus` (Postgres must be up). Expect green. If flaky, widen the await timeout — do NOT add fake timers.
- [ ] **Step 6 — Reviewer → fix loop:** reviewer confirms both instances disposed, no fake timers, promise-with-timeout (not `waitForTimeout`/sleep-then-assert), and that it does NOT use the transactional `createTestDbContext`.
- [ ] **Step 7 — Commit:** `git add apps/api/src/modules/events/__tests__ && git commit -m "test(events): PostgresEventBus cross-instance delivery + loopback + teardown (real Postgres)"`.

---

## Task 4: Docs + roadmap memory

**Files:** `CLAUDE.md`, `docs/05-auth-realtime.md`, the roadmap memory file. (The `EventBus` port comment is already handled in Task 2 Step 1.)

- [ ] **Step 1 — CLAUDE.md §9.** Add a "recent work" entry: realtime transport is now Postgres `LISTEN/NOTIFY` via `PostgresEventBus` (composes `InProcessEventBus`, one channel `mr_events`, Zod-validated inbound replay, guarded reconnect); wired ONLY in `createContainer` (`buildContainer` default stays `InProcessEventBus` → tests unchanged); `server.ts` disposes the bus on shutdown and the replica warning now points at the in-memory rate limiter; `numReplicas` stays 1; no migration / dep / permission / frontend change. **§2 "SSE = signal only" needs NO change** (semantics unchanged; it makes no single-process claim) — optionally add one line that the transport is Postgres NOTIFY.
- [ ] **Step 2 — docs/05-auth-realtime.md.** Rewrite the **"### Event bus architecture"** section (currently "In-process `EventEmitter`-based pub/sub. One instance per API process." + its stale code snippet at ~L207–214) to describe the `LISTEN/NOTIFY` transport wrapping the in-process fan-out. **Do NOT touch the "### Caching strategy" note (~L133–138)** — that "single API instance … Postgres NOTIFY/Redis" line is about the permission LRU cache, a separate concern this task does not address.
- [ ] **Step 3 — Roadmap memory.** Refresh `scaling-stack-qol-roadmap-2026-07-18` (in `/Users/nikola/.claude/projects/-Users-nikola-Developer/memory/`): mark roadmap item ① (SSE-via-Postgres-NOTIFY) as built; note it's replica-safe for SSE but `numReplicas` stays 1 (rate limiter still the blocker). Add a MEMORY.md index line if warranted.
- [ ] **Step 4 — Verify:** `pnpm format:check` (docs formatting) and read back the two doc edits to confirm the "### Caching strategy" note is untouched.
- [ ] **Step 5 — Commit:** `git add CLAUDE.md docs/05-auth-realtime.md && git commit -m "docs: realtime transport is Postgres LISTEN/NOTIFY"` (memory file committed separately or per house habit).

---

## Task 5: Full-gate QA (final)

**Depends on:** Tasks 1–4.

- [ ] **Step 1 — Full gate (`--force` per CLAUDE.md; Postgres must be up for integration):**
  ```
  pnpm format:check && pnpm exec turbo run build typecheck lint test --force \
    && pnpm --filter api depcruise && pnpm test:integration
  ```
  `pnpm format:write` first if `format:check` complains. A documented known flake (CLAUDE.md §8) reproduced on base is NOT a gate failure — note it, don't chase it.
- [ ] **Step 2 — Evidence (superpowers:verification-before-completion):** paste the final exit-0 lines for each gate stage; confirm the NEW integration test ran and passed inside `pnpm test:integration`; confirm depcruise is clean (no new `apps/*`→`packages/*` violation, `pg` value-import is a declared dep).
- [ ] **Step 3 — Finish the branch** (superpowers:finishing-a-development-branch): land the worktree branch, fast-forward onto `main` as prior phases. **STOP — Nikola pushes.** Do NOT `git push`.

---

## Risks / gotchas

- **Reconnect double-fire (spec §5).** A real drop (Railway restart / `FATAL 57P01` / `ECONNRESET`) makes a standalone `pg.Client` emit BOTH `'error'` AND `'end'` for the same disconnect. The single self-rescheduling connect LOOP (Task 1 Step 4) is REQUIRED so a drop triggers exactly ONE reconnect — both `'error'` and `'end'` just `resolve()` the same `closed` promise (idempotent), so the loop advances once. Two independent handlers each scheduling a reconnect = two backoff timers = two live LISTEN clients = doubled replay + one leaked connection per drop, compounding toward `max_connections`.
- **Attach `'error'` before `connect()`.** An unhandled `'error'` on a `pg.Client` is a Node EventEmitter throw = process crash. Wire the listener first.
- **Do NOT touch `buildContainer`'s default param.** ~25 integration suites go through `buildTestContainer → buildContainer` with no `eventBus` arg and rely on the default `new InProcessEventBus()`. Only `createContainer` constructs `PostgresEventBus`.
- **`pg_notify` 8000-byte limit.** Payloads are `kind + id(s)` (+ `customerId`) — far under it. No guard; a `ponytail:` comment names the ceiling.
- **JSON round-trip of enum-like values.** `ClaimEventPayload.kind` (`ClaimKind`) and `resource` (`ResourceChangedKey`) survive `JSON.stringify`/`parse` as plain strings; the inbound `NotifyMessageSchema` re-validates them against the shared const literal sets, so a foreign/old-version `kind` is dropped, not replayed as garbage.
- **Test flakiness from real async NOTIFY delivery.** Delivery is real IO — await via a promise-with-timeout, NOT fake timers / `vi.setSystemTime` / `waitForTimeout`. Widen the timeout if slow; never sleep-then-assert.
- **Leaked LISTEN connections in the shared `_test` DB.** Dispose BOTH instances (and `pool.end()`) in teardown. Use `getIntegrationDatabaseUrl()` + `createPool()`, NOT the transactional `createTestDbContext` (LISTEN/NOTIFY won't deliver inside a rolled-back BEGIN).
- **`pg` value import.** `import pg from 'pg'` (value, for `new pg.Client(...)`) is fine — `pg` is a declared direct dep (`^8.20.0`); depcruise won't flag it. Existing code only imports the `Pool` *type* from `pg`, so this is the first value import.

---

## Self-Review

- Replica-safe SSE via the Postgres we already run — no new service/dep/migration/permission/frontend change. ✓
- Zero consumer change: same 5 publish methods + `subscribeUser`; wrapped `InProcessEventBus` is the single fan-out truth (no double emit, no duplicated routing). ✓
- Test-safe: only `createContainer` swaps; `buildContainer` default untouched → all default-bus suites pass. ✓
- Correctness kept: single self-rescheduling reconnect loop (`'error'`+`'end'` resolve one `closed` promise → exactly one reconnect per drop), `'error'` listener attached before `connect()`, inbound Zod validation that never throws, parameterized `pg_notify`, dispose-on-shutdown. ✓
- Scope honored: SSE unblocked but `numReplicas` stays 1; the replica warning is reworded to the real remaining blocker (rate limiter), not removed. ✓
