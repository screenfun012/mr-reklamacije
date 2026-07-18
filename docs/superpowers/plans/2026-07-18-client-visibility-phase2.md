# Client Visibility (Phase 2 of Client Visibility v2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give EMOTIVE claims a private→published lifecycle so an operator builds a claim without the client seeing the real outcome, then publishes to reveal it — 3 client stages (Primljeno → U obradi → Ishod), server-masked outcome while private, server-computed `clientPhase`, a two-click publish, and the outcome email firing only on reveal. DOMACE and the internal outcome/statistics are unchanged.

**Architecture:** Two nullable timestamps on `emotive_claims` (`client_visible_at`, `published_at`) drive a derived client stage. Gate A auto-sets `client_visible_at` the first time the client-visible Inspection report is written (monotonic). Gate B sets `published_at` via an explicit `POST /:id/publish` (new `emotive_claims.publish` permission). The client wire carries a server-computed `clientPhase` and masks `outcome`/`dateOfFinish` while `published_at IS NULL`; a `findById` gate 404s a Primljeno claim's detail for client-role users. Existing claims backfill to published so nothing hides retroactively.

**Tech Stack:** Drizzle + drizzle-kit (migration), Hono (api), Zod/`@mr/shared` (schemas + permissions), TanStack Start + React Query (internal-web publish UI, portal 3-bar), Vitest + real Postgres.

**Reference spec:** `docs/superpowers/specs/2026-07-18-client-visibility-v2-design.md` §4, §6, §8, §9, §10.

## Global Constraints

- **Touches a MIGRATION and AUTH (a new permission). Per CLAUDE.md both require Nikola's explicit approval before executing** — approving this plan is that approval. The migration MUST be `drizzle-kit generate`d (never hand-written SQL), proven clean migrate-from-zero, and confirmed to be only the intended DDL before applying.
- Scope is **EMOTIVE only** (only EMOTIVE has a portal). Do NOT add any visibility concept to DOMACE.
- The client field **whitelist is unchanged** — clients still only ever receive the existing safe set. `client_visible_at`/`published_at` are internal; they must NOT appear on any client wire payload (they only drive masking + `clientPhase`).
- **Statistics / Excel / internal dashboards read the real `outcome` and are unaffected** — never gate a statistics query on visibility.
- Masking is defense-in-depth: the real outcome must never leave the server while `published_at IS NULL`.
- TDD, real Postgres for integration (test DB ends in `_test`). Full gate green before each commit.
- Conventional commits + repo trailers; do not push (subagent-driven controller lands the branch).

---

### Task 1: Migration — visibility timestamps + backfill

**Files:**
- Modify: `packages/db/src/schema/claims.ts` (add two columns to `emotiveClaims`, near `outcomeResolvedAt`/`inspectionReport`)
- Generate: `packages/db/migrations/00NN_*.sql` (+ meta) via drizzle-kit
- Test: covered by migrate-from-zero in the integration global setup + a repo test in Task 3

**Interfaces:**
- Produces: `emotiveClaims.clientVisibleAt` (`timestamptz` null), `emotiveClaims.publishedAt` (`timestamptz` null).

- [ ] **Step 1:** In `packages/db/src/schema/claims.ts`, add to the `emotiveClaims` table definition:
```ts
    clientVisibleAt: timestamp('client_visible_at', { withTimezone: true, mode: 'date' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
```
- [ ] **Step 2:** Generate the migration: `pnpm --filter @mr/db run db:generate`. Confirm the generated SQL adds ONLY these two nullable columns to `emotive_claims` (no other DDL). Then append a **backfill** statement to the generated migration file so existing rows stay visible:
```sql
UPDATE "emotive_claims" SET "published_at" = "created_at" WHERE "published_at" IS NULL;
```
(Existing claims → published; new claims default both NULL → Primljeno.)
- [ ] **Step 3:** Prove clean migrate-from-zero on an empty test DB (the integration global setup does this; run `pnpm --filter api test:integration` and confirm the chain applies). Verify EXPLAIN/`\d emotive_claims` shows the two columns.
- [ ] **Step 4: Commit** `feat(db): emotive client-visibility timestamps (migration NN) + backfill existing to published`.

---

### Task 2: Shared — clientPhase + masking (the wire contract)

**Files:**
- Modify: `packages/shared/src/schemas/client-claim.schema.ts` (deriveClientClaimPhase signature; add `clientPhase` to the client schemas; mask outcome/dateOfFinish in `toClientClaimListItem`/`toClientClaimDetail`)
- Modify: `packages/shared/src/schemas/emotive-claim.schema.ts` (add internal `clientVisibleAt`/`publishedAt` to `EmotiveClaimDetail`/list-item so the projection can read them) + the claim-list schema `ClaimListItem`
- Test: `packages/shared/src/schemas/__tests__/client-claim.schema.test.ts`

**Interfaces:**
- Consumes: `EmotiveClaimDetail`/`ClaimListItem` now carry `clientVisibleAt: string|null`, `publishedAt: string|null` (internal, full-view only).
- Produces: `deriveClientClaimPhase(outcome, { clientVisibleAt, publishedAt })`; `ClientClaimListItem`/`ClientClaimDetail` gain `clientPhase: ClientClaimPhase`; masking helper `isClaimPublished(v)`.

- [ ] **Step 1: Failing tests** in `client-claim.schema.test.ts`:
```ts
// stage derivation
expect(deriveClientClaimPhase('accepted', { clientVisibleAt: null, publishedAt: null })).toBe(ClientClaimPhase.Received)
expect(deriveClientClaimPhase('accepted', { clientVisibleAt: 'x', publishedAt: null })).toBe(ClientClaimPhase.InProgress) // masked
expect(deriveClientClaimPhase('accepted', { clientVisibleAt: 'x', publishedAt: 'y' })).toBe(ClientClaimPhase.Outcome)
expect(deriveClientClaimPhase('pending',  { clientVisibleAt: 'x', publishedAt: 'y' })).toBe(ClientClaimPhase.InProgress) // published but pending → real in-progress
// masking on the wire
const priv = toClientClaimListItem({ ...fullItem, outcome: 'accepted', dateOfFinish: '2026-01-01', clientVisibleAt: 'x', publishedAt: null })
expect(priv.outcome).toBe('pending'); expect(priv.dateOfFinish).toBeNull(); expect(priv.clientPhase).toBe('in_progress')
const pub = toClientClaimListItem({ ...fullItem, outcome: 'accepted', dateOfFinish: '2026-01-01', clientVisibleAt: 'x', publishedAt: 'y' })
expect(pub.outcome).toBe('accepted'); expect(pub.clientPhase).toBe('outcome')
```
- [ ] **Step 2: Run — verify FAIL** (`pnpm --filter @mr/shared test`).
- [ ] **Step 3: Implement.**
  - `deriveClientClaimPhase(outcome, { clientVisibleAt, publishedAt })`: `published_at` null → (`client_visible_at` null → Received; else InProgress). `published_at` set → (`outcome === pending` → InProgress; else Outcome). Update its doc comment (the 2026-07-04 "pure fn of outcome" note is superseded).
  - `ClientClaimListItemSchema`/`DetailSchema`: add `clientPhase: z.enum(clientClaimPhaseValues)`.
  - `toClientClaimListItem`/`toClientClaimDetail`: accept the (now-present) `clientVisibleAt`/`publishedAt`; compute `const published = item.publishedAt !== null`; set `outcome: published ? item.outcome : ClaimOutcome.Pending`, `dateOfFinish: published ? item.dateOfFinish : null`, `clientPhase: deriveClientClaimPhase(item.outcome, { clientVisibleAt, publishedAt })`. Do NOT copy `clientVisibleAt`/`publishedAt` onto the output (keep the whitelist tight).
  - Add `clientVisibleAt`/`publishedAt` to `EmotiveClaimDetail` + `ClaimListItem` (full/internal schemas) as `z.string().nullable()`.
- [ ] **Step 4: Run — verify PASS.** Update the unified list-item fixture + any test that constructs a `ClaimListItem`/detail (add the two fields).
- [ ] **Step 5: Commit** `feat(shared): client-visibility masking + clientPhase on the client wire`.

---

### Task 3: API — detail-access gate + carry the timestamps

**Files:**
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.repository.ts` (select the two new columns into detail + list-item rows)
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.service.ts` (`findById` gate: client-scoped user + Primljeno → NotFound)
- Test: `apps/api/src/modules/emotive-claims/__tests__/emotive-claims.integration.test.ts`

**Interfaces:**
- Consumes: `resolveListScope(actor)` → `{ type: 'own_customer' | 'all', ... }` (existing). A client is `own_customer`.
- Produces: repo rows include `clientVisibleAt`/`publishedAt`; `findById` returns null (→404) for a client on a Primljeno claim.

- [ ] **Step 1: Failing integration tests:** a `view_own_customer` client gets 404 on a claim with `client_visible_at IS NULL AND published_at IS NULL`; gets the claim (masked) once `client_visible_at` is set; a full-view operator always gets it. Seed the claim + set the timestamps directly via the repo/db.
- [ ] **Step 2: Run — verify FAIL.**
- [ ] **Step 3: Implement.** Add the two columns to the repo's detail + list SELECTs (map to `clientVisibleAt`/`publishedAt`). In `service.findById`, after loading: `if (scope.type === 'own_customer' && claim.clientVisibleAt === null && claim.publishedAt === null) throw new NotFoundError(...)`. (404 not 403 — don't leak existence, per the security rule.) The list already returns all own-customer claims; those stay visible as cards (masked) — do NOT filter Primljeno out of the list (the client sees the "Primljeno" card, just can't open it).
- [ ] **Step 4: Run — verify PASS.** Also confirm attachments + client PDF go through the same `loadClaimContext`/`findById` path so they 404 too (add a test if a separate path exists).
- [ ] **Step 5: Commit** `feat(emotive-claims): 404 a private (Primljeno) claim's detail for client-role users`.

---

### Task 4: API — Gate A (inspection report → client_visible_at)

**Files:**
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.repository.ts` (in the update path: when the incoming inspectionReport becomes non-empty and `client_visible_at IS NULL`, set `client_visible_at = now()` in the same UPDATE — monotonic, never cleared)
- Test: the emotive integration suite

**Interfaces:**
- Produces: writing a non-empty `inspectionReport` on a claim with `client_visible_at IS NULL` sets it once.

- [ ] **Step 1: Failing test:** update a Primljeno claim with a non-empty `inspectionReport` → `client_visible_at` becomes non-null (stage → U obradi); a second update clearing the report leaves `client_visible_at` set (monotonic); updating other fields on a Primljeno claim (no inspection report) leaves it null.
- [ ] **Step 2: Run — verify FAIL.**
- [ ] **Step 3: Implement** in the repo update (SQL twin): `client_visible_at = COALESCE(client_visible_at, CASE WHEN <new inspection_report is non-empty> THEN now() END)`. Keep it inside the existing single update transaction. (Do the same in the create path if a claim can be created with an inspection report already filled.)
- [ ] **Step 4: Run — verify PASS.**
- [ ] **Step 5: Commit** `feat(emotive-claims): Gate A — first client-visible inspection report advances the claim to "u obradi"`.

---

### Task 5: API — Gate B (publish endpoint + permission)

**Files:**
- Modify: `packages/shared/src/permissions.ts` (add `'emotive_claims.publish'`) + permission-set tests
- Modify: `packages/db/src/seed/roles.ts` (grant `emotive_claims.publish` to operator; admin gets it via ALL_PERMISSIONS)
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.{routes,controller,service,repository}.ts` (verb endpoint `POST /:id/publish`)
- Test: emotive integration suite

**Interfaces:**
- Produces: `POST /api/emotive-claims/:id/publish` (requires `emotive_claims.publish`) sets `published_at = now()` if null (idempotent/CAS), audits, emits SSE `publishClaimUpdated`, returns the updated detail.

- [ ] **Step 1: Failing tests:** an operator with `emotive_claims.publish` publishes → `published_at` set, audit row written, and the claim's client projection now shows the real outcome; publishing an already-published claim is a no-op (still returns 200, `published_at` unchanged); a user without the permission gets 403.
- [ ] **Step 2: Run — verify FAIL.**
- [ ] **Step 3: Implement.** Add the permission + operator grant. Add `service.publish(id, actor, auditContext)`: load (own scope N/A — this is an operator action), set `published_at = COALESCE(published_at, now())` via a repo method, audit (`AuditAction.Update`, `changes: { transition: 'publish' }`), `events.publishClaimUpdated(...)`. Wire `routes.ts` (`requirePermission('emotive_claims.publish')`) + `controller.ts`. Follow the existing `change-outcome` verb-endpoint shape exactly.
- [ ] **Step 4: Run — verify PASS.** `pnpm exec turbo run typecheck test --filter=@mr/shared --filter=@mr/db --force`.
- [ ] **Step 5: Commit** `feat(emotive-claims): Gate B — publish endpoint + emotive_claims.publish permission`. Note in the body: prod needs one `db:seed` after deploy to insert the permission + grant it to operator.

---

### Task 6: API — outcome email fires on reveal, not while private

**Files:**
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.service.ts` (`notifyClientOutcomeChanged` gating; call it from `publish` too)
- Test: emotive integration suite (email mocked)

**Interfaces:**
- Produces: the outcome email fires exactly when a **decided** outcome first becomes client-visible: (publish while outcome is accepted/rejected) OR (changeOutcome to a decided value while already published). Never while `published_at IS NULL`.

- [ ] **Step 1: Failing tests** (EmailPort mocked, assert send count): changeOutcome→accepted while private → NOT sent; publish (outcome already accepted) → sent once; publish while pending then changeOutcome→rejected → sent once on the outcome change; changeOutcome on an already-published-and-decided claim (re-decide) → sent (it's an UPDATE to the client).
- [ ] **Step 2: Run — verify FAIL.**
- [ ] **Step 3: Implement.** Guard `notifyClientOutcomeChanged` on `claim.publishedAt !== null && claim.outcome !== 'pending'`; call it from `changeOutcome` (existing) and from `publish`. Keep the existing admin toggle + fire-and-settle behavior.
- [ ] **Step 4: Run — verify PASS.**
- [ ] **Step 5: Commit** `feat(emotive-claims): outcome email fires when a decided outcome first becomes client-visible`.

---

### Task 7: internal-web — publish action + stage indicator

**Files (read each first):**
- Modify: `apps/internal-web/src/features/emotive-claims/detail/emotive-claim-detail-header.tsx` / `emotive-claim-status-actions.tsx` — add an "Objavi klijentu" button (visible while `publishedAt` is null; gated on the publish permission via `<Can>`), a stage badge (Primljeno / U obradi / Objavljeno) derived from the claim's `clientVisibleAt`/`publishedAt`, and a "Još nije objavljeno" cue.
- Create: `apps/internal-web/src/features/emotive-claims/detail/use-publish-emotive-claim.ts` (mutation → `POST /api/emotive-claims/:id/publish`, routes invalidation through `invalidateInternalClaimQueries`).
- Modify: i18n `en.json`+`sr.json` (publish button + confirm copy) — parity.
- Test: `emotive-claim-status-actions.test.tsx`

- [ ] **Step 1:** Read the header/status-actions files + `use-change-emotive-claim-outcome.ts` (for the mutation+ConfirmDialog pattern).
- [ ] **Step 2: Failing test:** clicking "Objavi klijentu" opens a `ConfirmDialog` whose copy names the current outcome (e.g. "Klijent će videti ishod: PRIHVAĆENO"; while pending: "trenutni status: U obradi") and the publish mutation fires only on confirm; the button is absent once `publishedAt` is set; the stage badge reads the three states.
- [ ] **Step 3: Run — verify FAIL.**
- [ ] **Step 4: Implement** the hook + button + confirm + stage badge (2-click, `ConfirmDialog`, no `window.confirm`).
- [ ] **Step 5: Run — verify PASS** + `pnpm --filter internal-web typecheck lint`.
- [ ] **Step 6: Commit** `feat(internal-web): publish-to-client action + claim stage indicator`.

---

### Task 8: portal-web — live 3-stage status

**Files (read each first):**
- Modify: `apps/portal-web/src/features/claims/timeline-card.tsx`, `dashboard-cards.tsx`, and the claim card/detail that render status — render the server-sent `clientPhase` directly (reactivate `ClientClaimPhase.Received` as a LIVE status: bar 1 blue "Primljeno"; a Primljeno card is not clickable — no detail link — matching the 404 gate); InProgress = bar 2; Outcome = bar 3 with the (now-real) verdict.
- Modify: the portal's client-claim query/schema consumption to read `clientPhase` (the wire now carries it; the portal no longer calls `deriveClientClaimPhase`).
- Test: the portal component tests for the status chip / timeline.

- [ ] **Step 1:** Read the portal status/timeline/card components + how they currently derive phase.
- [ ] **Step 2: Failing tests:** a Primljeno claim renders the "Primljeno" chip (bar 1) and its card is non-clickable / shows no detail link; an InProgress claim renders bar 2 and IS clickable; an Outcome claim renders the verdict. The portal uses `claim.clientPhase`, not a local derivation.
- [ ] **Step 3: Run — verify FAIL.**
- [ ] **Step 4: Implement.** Replace local phase derivation with `clientPhase`; wire the Primljeno non-clickable card; keep the existing chip/tri-bar styling (extend Received to a live state).
- [ ] **Step 5: Run — verify PASS** + `pnpm --filter portal-web typecheck lint`.
- [ ] **Step 6: Commit** `feat(portal): live Primljeno → U obradi → Ishod status from server clientPhase`.

---

### Task 9: dashboard client-summary respects visibility

**Files:**
- Modify: `apps/api/src/modules/dashboard/dashboard.repository.ts` + `dashboard.service.ts` (the client-summary phase-bucketing + activity feed): a not-yet-published claim buckets under "received"/"in_progress" per `clientPhase`, never under a decided outcome; the activity feed must not reveal a decided outcome for a private claim.
- Test: `dashboard.integration.test.ts`

- [ ] **Step 1: Failing tests:** for a `view_own_customer` client, a private (accepted-internally) claim counts under in-progress/received, NOT under accepted; the activity feed shows no "Outcome/accepted" event for it until published.
- [ ] **Step 2: Run — verify FAIL.**
- [ ] **Step 3: Implement** — bucket by the same visibility-aware `clientPhase`; gate the feed's outcome event on `published_at`.
- [ ] **Step 4: Run — verify PASS.**
- [ ] **Step 5: Commit** `fix(dashboard): client-summary + activity feed honor claim visibility`.

---

### Task 10: docs + full gate

**Files:** `CLAUDE.md` (§2 + §9: record the EMOTIVE client-visibility model + the new permission + the `deriveClientClaimPhase(visibility)` change), `docs/03-permissions.md` (add `emotive_claims.publish`), `docs/05`/`docs/04` where the portal-mirrors-outcome rule is described.

- [ ] **Step 1:** Update the docs to the shipped behavior.
- [ ] **Step 2: Run the full gate** (`pnpm format:check && pnpm exec turbo run build typecheck lint test --force && pnpm --filter api depcruise && pnpm test:integration`). Green.
- [ ] **Step 3: Commit** `docs: record the EMOTIVE client-visibility (private/publish) model`.

---

## Self-Review

- **Spec coverage:** §4 data model → T1; §4 stage derivation + §6 masking/clientPhase/detail-gate → T2/T3; Gate A → T4; Gate B + permission → T5; §9 email → T6; §8 internal UI → T7; §6 portal 3-bar → T8; §10 client-summary → T9; docs → T10. NEW/UPDATE (§7) is Phase 3, out of scope. ✓
- **Placeholder scan:** frontend Tasks 7/8 reference files to read (JSX not yet read) — deliberate; backend tasks carry concrete code/tests. ✓
- **Type consistency:** `clientVisibleAt`/`publishedAt` (camel) on internal schemas; `client_visible_at`/`published_at` (snake) in DB; `clientPhase` on the client wire; `deriveClientClaimPhase(outcome, { clientVisibleAt, publishedAt })` signature used identically in T2 and consumed in T8. ✓

## Out of scope (Phase 3)

`client_content_updated_at` column + `emotive_claim_client_views` table + NEW/UPDATE per-client badges. Its own plan.
