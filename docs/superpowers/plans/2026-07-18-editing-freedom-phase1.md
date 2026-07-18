# Editing Freedom (Phase 1 of Client Visibility v2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the outcome-based edit lock so operators can freely edit any claim (EMOTIVE and DOMACE) regardless of outcome, with every change audited — killing the admin "reopen" dance and the client-facing flicker it caused.

**Architecture:** Delete the lock/`reopen` layer (`claim-lock.ts` guards + `is-internal-notes-only-update.ts` carve-out) from both claim services and the report service; retire the two `*.reopen` permissions; drop the now-dead frontend "reopen" UI. Delete = permission + ConfirmDialog (unchanged route permission). Everything else (audit, SSE, outcome email) stays as-is.

**Tech Stack:** Hono + Drizzle (api), TanStack Start + React Query (internal-web), Vitest + real Postgres for integration, `@mr/shared` for permissions.

**Reference spec:** `docs/superpowers/specs/2026-07-18-client-visibility-v2-design.md` §3 (Pillar 1), §5.

## Global Constraints

- **This phase touches AUTH (removes two permissions). Per CLAUDE.md, requires Nikola's explicit approval before executing** — approving this plan is that approval.
- TDD, real Postgres for integration tests (test DB name must end in `_test`).
- Full CI gate green before each commit: `pnpm format:check && pnpm exec turbo run build typecheck lint test --force && pnpm --filter api depcruise && pnpm test:integration`.
- Conventional commits; end messages with the repo's Co-Authored-By + Claude-Session trailers. Nikola pushes / authorizes push.
- No behavior change to statistics, the outcome email, SSE, or the client portal in this phase.
- Keep `assertAcceptedClaimAmountEditable` (DOMACE repair-amount business rule — NOT the lock).

---

### Task 1: EMOTIVE — operator edits/deletes/re-decides a completed claim without reopen

**Files:**
- Modify: `apps/api/src/modules/emotive-claims/emotive-claims.service.ts` (remove lock guards at update ~154-156, softDelete ~188-194, changeOutcome ~255-258; drop `EMOTIVE_REOPEN_PERMISSION`; drop the `assertClaimEditable`/`assertCompletedActionAllowed`/`assertOutcomeTransitionAllowed`/`isInternalNotesOnlyUpdate` imports; simplify the changeOutcome audit `changes` to always `{ before, after: updated, outcome: input.outcome }`)
- Test: `apps/api/src/modules/emotive-claims/__tests__/emotive-claims.integration.test.ts`

**Interfaces:**
- Consumes: existing `EmotiveClaimsService.{update,softDelete,changeOutcome}` signatures (unchanged).
- Produces: no signature change — only the outcome-lock precondition is removed.

- [ ] **Step 1: Write failing tests** (add to the integration suite; seed an EMOTIVE claim then set outcome to `accepted`)

```ts
it('lets an operator edit an accepted claim without reopen', async () => {
  const claim = await createSeededEmotiveClaim({ outcome: 'accepted' }) // helper already in suite
  const updated = await service.update(
    claim.id,
    { warrantyReport: 'edited after acceptance' },
    operatorActor, // has emotive_claims.edit, NOT emotive_claims.reopen
    httpCtx,
  )
  expect(updated.warrantyReport).toBe('edited after acceptance')
})

it('lets an operator delete an accepted claim without reopen', async () => {
  const claim = await createSeededEmotiveClaim({ outcome: 'accepted' })
  await expect(service.softDelete(claim.id, operatorActor, httpCtx)).resolves.toBeUndefined()
})

it('lets an operator switch accepted → rejected directly without reopen', async () => {
  const claim = await createSeededEmotiveClaim({ outcome: 'accepted' })
  const updated = await service.changeOutcome(claim.id, { outcome: 'rejected' }, operatorActor, httpCtx)
  expect(updated.outcome).toBe('rejected')
})
```

*(Match the suite's existing seeding/actor helpers — read the top of the file for the exact `operatorActor`/`createSeeded…`/`httpCtx` names and adapt.)*

- [ ] **Step 2: Run to verify they FAIL**

Run: `pnpm --filter api test:integration -- emotive-claims.integration`
Expected: FAIL — the three throw `ConflictError`/`ForbiddenError` ("Claim is locked…").

- [ ] **Step 3: Remove the lock guards in the service**

In `update`, delete:
```ts
    if (!isInternalNotesOnlyUpdate(input)) {
      assertClaimEditable(before)
    }
```
In `softDelete`, delete the `assertCompletedActionAllowed(...)` block (comment + call, ~188-194).
In `changeOutcome`, replace:
```ts
    const isReopen = assertOutcomeTransitionAllowed(before.outcome, input.outcome, {
      reopenPermission: EMOTIVE_REOPEN_PERMISSION,
      permissions: actor.permissions,
    })
```
with nothing, and simplify the audit `changes` to:
```ts
      changes: { before, after: updated, outcome: input.outcome },
```
Remove the now-unused imports (`assertClaimEditable`, `assertCompletedActionAllowed`, `assertOutcomeTransitionAllowed`, `isInternalNotesOnlyUpdate`) and the `const EMOTIVE_REOPEN_PERMISSION = 'emotive_claims.reopen'` line.

- [ ] **Step 4: Run to verify they PASS** (and no other emotive test regressed)

Run: `pnpm --filter api test:integration -- emotive-claims.integration`
Expected: PASS. Fix any existing test that asserted the old locked-behavior (flip its expectation to "allowed").

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/emotive-claims
git commit -m "feat(emotive-claims): free editing — drop the outcome lock and reopen guard"
```

---

### Task 2: DOMACE — same, without reopen

**Files:**
- Modify: `apps/api/src/modules/domace-claims/domace-claims.service.ts` (mirror Task 1: remove guards at update ~112-113, softDelete ~184-187, changeOutcome ~249; drop `DOMACE_REOPEN_PERMISSION`; drop the same imports; simplify the changeOutcome audit `changes`)
- Test: `apps/api/src/modules/domace-claims/__tests__/domace-claims.integration.test.ts`

**Interfaces:**
- Consumes/Produces: identical to Task 1 for the DOMACE service. Keep `assertAcceptedClaimAmountEditable` untouched.

- [ ] **Step 1: Write the same three failing tests** for the DOMACE service (edit / delete / accepted→rejected without reopen), using the domace suite's seeding helpers.
- [ ] **Step 2: Run — verify FAIL** (`pnpm --filter api test:integration -- domace-claims.integration`).
- [ ] **Step 3: Remove the guards** in `domace-claims.service.ts` exactly mirroring Task 1 Step 3.
- [ ] **Step 4: Run — verify PASS**; flip any existing locked-behavior assertions.
- [ ] **Step 5: Commit** `feat(domace-claims): free editing — drop the outcome lock and reopen guard`.

---

### Task 3: Claim reports editable on a completed claim

**Files:**
- Modify: `apps/api/src/modules/claim-reports/claim-reports.service.ts` (remove `assertClaimEditable(claim)` at ~103 and its import)
- Test: `apps/api/src/modules/claim-reports/__tests__/claim-reports.integration.test.ts`

- [ ] **Step 1: Failing test** — upsert a report on an `accepted` claim succeeds.
- [ ] **Step 2: Run — verify FAIL** (currently `ConflictError`).
- [ ] **Step 3:** delete `assertClaimEditable(claim)` + its import.
- [ ] **Step 4: Run — verify PASS.**
- [ ] **Step 5: Commit** `feat(claim-reports): allow report writes on completed claims (documentation lands after the decision)`.

---

### Task 4: Delete the dead lock/carve-out helpers

**Files:**
- Modify: `apps/api/src/core/claims/claim-lock.ts` — delete `ClaimReopenAuth`, `assertClaimEditable`, `assertOutcomeTransitionAllowed`, `assertCompletedActionAllowed`. Keep `assertAcceptedClaimAmountEditable` only.
- Delete: `apps/api/src/core/claims/is-internal-notes-only-update.ts`
- Delete: `apps/api/src/core/claims/__tests__/is-internal-notes-only-update.test.ts`
- Modify: `apps/api/src/core/claims/__tests__/` — remove any `claim-lock` tests covering the deleted functions (keep the amount-editable test if present).

**Interfaces:**
- Produces: `claim-lock.ts` now exports only `assertAcceptedClaimAmountEditable`. No consumer references the deleted symbols (Tasks 1–3 removed them all).

- [ ] **Step 1:** Delete the two files and the dead exports.
- [ ] **Step 2: Run** `pnpm --filter api typecheck` — Expected: PASS (no dangling references). If any remain, they point at a missed usage — fix it.
- [ ] **Step 3: Run** `pnpm --filter api test` — Expected: PASS.
- [ ] **Step 4: Commit** `refactor(api): remove the retired claim edit-lock and reopen helpers`.

---

### Task 5: Retire the `*.reopen` permissions

**Files:**
- Modify: `packages/shared/src/permissions.ts` (remove `'emotive_claims.reopen'` line 23 and `'domace_claims.reopen'` line 34)
- Modify: `packages/shared/src/**` permission tests asserting the count/set of permissions (adjust the expected list)
- Modify: `packages/db/src/seed/*` — if the role→permission grants reference `*.reopen`, remove those grants (grep `reopen` under `packages/db/src/seed`)
- Modify: any `apps/api` test fixture granting `*.reopen` to an actor (grep and drop)

**Interfaces:**
- Produces: `PERMISSIONS` no longer contains the two reopen codes; the resolver/seed no longer grant them.

- [ ] **Step 1:** grep `reopen` across `packages/shared`, `packages/db/src/seed`, `apps/api/src/**/__tests__` — enumerate every reference.
- [ ] **Step 2:** Remove the two permission strings + any grants + any test fixtures granting them.
- [ ] **Step 3: Run** `pnpm exec turbo run typecheck test --filter=@mr/shared --filter=@mr/db --force` — Expected: PASS.
- [ ] **Step 4: Prod note (in the commit body):** existing prod `permissions`/`role_permissions` rows for `*.reopen` become orphaned; a follow-up `db:seed` reconciliation or a one-off cleanup removes them (same pattern as the 2026-07-18 client-visibility cleanup). Not required for correctness (unused).
- [ ] **Step 5: Commit** `feat(auth): retire the emotive/domace reopen permissions (editing no longer locks)`.

---

### Task 6: Remove the dead frontend "reopen" UI + confirm outcome change

**Files (read each before editing — reproduce this task's intent against the actual JSX):**
- Modify: `apps/internal-web/src/features/emotive-claims/detail/emotive-claim-status-actions.tsx` and `.../emotive-claim-detail-header.tsx` — remove any "reopen / otključaj" action/button and its mutation; the claim is always editable now.
- Modify: `apps/internal-web/src/features/domace-claims/detail/domace-claim-status-actions.tsx`, `.../domace-claim-detail-header.tsx` — same.
- Modify: `apps/internal-web/src/features/*/detail/use-change-*-claim-outcome.ts` — wrap the outcome change in a `ConfirmDialog` ("Promeniti ishod na PRIHVAĆENO?"). (The stronger *published-aware* copy comes in Phase 2; here it is the base confirm.)
- Modify: `apps/internal-web/src/features/emotive-claims/detail/__tests__/emotive-claim-status-actions.test.tsx` — drop reopen assertions, add the confirm assertion.

- [ ] **Step 1:** Read the four detail/status-action files; identify the reopen button + mutation wiring.
- [ ] **Step 2: Failing test** in `emotive-claim-status-actions.test.tsx` — changing the outcome opens a `ConfirmDialog` and only calls the mutation on confirm; there is no "reopen" control.
- [ ] **Step 3: Run — verify FAIL.**
- [ ] **Step 4:** Remove the reopen controls/mutations; route outcome change through `ConfirmDialog`.
- [ ] **Step 5: Run — verify PASS** + `pnpm --filter internal-web typecheck lint`.
- [ ] **Step 6: Commit** `feat(internal-web): drop the reopen UI; confirm outcome changes`.

---

### Task 7: Docs + full gate

**Files:**
- Modify: `CLAUDE.md` §2 (Domain invariants) — the "completed claim is locked until reopen" invariant is replaced by "claims are always editable (audit-tracked); outcome change and delete are confirmed". Note EMOTIVE client-facing behavior is unchanged in this phase (Phase 2).
- Modify: `docs/` claims doc if it documents the lock.

- [ ] **Step 1:** Update the invariant text.
- [ ] **Step 2: Run the full gate** (Global Constraints command). Expected: all green.
- [ ] **Step 3: Commit** `docs: record the retirement of the claim edit-lock`.

---

## Self-Review

- **Spec coverage:** §3 Pillar 1 (lock removal both kinds, reopen retired, delete confirm, amount rule kept, audit) → Tasks 1–7. §5 (server editability) → Tasks 1–5. Outcome-change confirm → Task 6. Statistics/email/SSE unchanged → asserted by "no behavior change" constraint + existing tests. ✓
- **Placeholder scan:** frontend Task 6 references files to read rather than reproducing unread JSX — this is deliberate (the JSX is not yet read); every backend task carries the exact code. ✓
- **Type consistency:** the removed symbols (`assertClaimEditable`, `assertOutcomeTransitionAllowed`, `assertCompletedActionAllowed`, `isInternalNotesOnlyUpdate`, `*_REOPEN_PERMISSION`, `ClaimReopenAuth`) are removed everywhere they are produced/consumed (Tasks 1–5). `assertAcceptedClaimAmountEditable` is the only survivor. ✓

## Out of scope (later phases)

- Phase 2: EMOTIVE client visibility (migration: `client_visible_at`/`published_at`/`client_content_updated_at`, gates A/B, outcome masking, `clientPhase` wire field, `emotive_claims.publish` + publish endpoint, email-on-reveal, portal 3-bar). Its own plan.
- Phase 3: NEW/UPDATE freshness (`emotive_claim_client_views` + badges). Its own plan.
