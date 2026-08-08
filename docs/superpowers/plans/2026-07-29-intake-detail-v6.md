# V-6-1 Intake Order Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the intake order's detail screen — four tabs, status correction, removal and restore, and a reduced view for an unfinished intake — replacing the `IntakePhasePlaceholder` at `/prijem/$id`.

**Architecture:** Two passes. **V-6-1a (Tasks 1–5)** is server work with integration tests and no new screen: the history projection is filtered, an unfinished draft becomes writable only by its own serviser, the photo counter survives amendments, a removed order can be read and restored, and the list's `unfinished` flag becomes a three-way `view`. **V-6-1b (Tasks 6–13)** builds the screen on top of it. Server first because the ownership rule changes code V-3 and V-5 already shipped.

**Tech Stack:** Hono + Drizzle + PostgreSQL (api) · TanStack Start/Router + React 19 + TanStack Query (internal-web) · Zod (`@mr/shared`) · Paraglide (`@mr/i18n`) · Vitest (unit + integration) · Tailwind v4 with `mri-*` tokens.

**Source of truth:** `docs/superpowers/specs/2026-07-29-intake-detail-v6-design.md` (this plan implements it section by section) and `~/Downloads/handoff 3/prijem-prototip-v2.dc.html` lines 420–646 for every visual value.

## Global Constraints

- **No migration.** Every column this plan reads already exists. If a task seems to need DDL, stop and report — it is a finding.
- **No new permission.** Restore reuses `intake_orders.delete`.
- **404, never 403, for row-level scope.** A serviser must not learn a colleague's order exists. 403 is correct only where the caller legitimately knows the row exists (an operator refused on a draft).
- **Colours only through `mri-*` utility classes.** Never `var(--mri-warn)` / `var(--mri-archived)` — the status hues exist only inside `@theme inline` and an unresolved `var()` silently drops the property to its initial value (CLAUDE.md §5).
- **No ICU plurals.** Paraglide in this repo rejects them. Phrase counts so no grammatical form depends on the number (`Ukupno: 12`, never `12 naloga`).
- **sr + en key parity is CI-enforced.** Every new key lands in both `packages/i18n/src/messages/sr.json` and `en.json`. After editing them run `pnpm --filter @mr/i18n run compile` or dev keeps showing the old text.
- **Style:** no semicolons, single quotes, 2-space indent, trailing commas. `kebab-case` files, `PascalCase` components. No `any`, no non-null `!`, no `enum`. Guard clauses over nesting. **No nested ternaries — use a lookup map or a helper function.** Functions under 30 lines. Explicit return types on exported functions, service and repository methods.
- **Layer law:** the controller never touches the DB; the service and repository never import `hono`. Audit in the service layer.
- **Never start or kill the dev servers.** `pnpm dev:all` is the owner's terminal. Verification uses one-off commands that exit.
- **Full gate before every commit:**
  `pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration`
- **Commit only what the task names.** Conventional commits. Do not push — the owner is told when a pass is green.

---

## File Structure

**V-6-1a — api and shared**

| File | Responsibility |
| --- | --- |
| `apps/api/src/modules/intake-orders/intake-orders.repository.ts` | history filter, `findById({includeDeleted})`, `restore`, `shiftPhotosExpected`, the three-way scope condition |
| `apps/api/src/modules/intake-orders/intake-orders.service.ts` | `spec_updated` transition, `assertDraftOwner`, `assertNotDeleted`, `restore`, view-permission refusal |
| `apps/api/src/modules/intake-orders/intake-orders.controller.ts` + `.routes.ts` | the `POST /:id/restore` endpoint |
| `apps/api/src/core/errors/domain-errors.ts` + `core/middleware/error-handler.ts` | a conflict error that can carry the clashing order in `details` |
| `packages/shared/src/schemas/intake-order.wire.schema.ts` | `deletedAt` on the detail, `view` on the list query, `IntakeDetailSearchSchema` |
| `packages/shared/src/queries/intake-orders.ts` | `view` through the filters type + `intakeFiltersFromSearch` + the query builder; `restoreIntakeOrder` |
| `apps/internal-web/src/routes/_shell/prijem/index.tsx` + `features/intake-orders/intake-filter-bar.tsx` | the view select (they must move with the rename or the pass is not gate-green) |

**V-6-1b — internal-web**

| File | Responsibility |
| --- | --- |
| `features/intake-orders/intake-labels.ts` | checklist / vehicle-type / arrival-mode label maps, shared by wizard and detail |
| `features/intake-orders/wizard/intake-photo-lightbox.tsx` | the overlay extracted out of `step-damage-photos.tsx` |
| `features/intake-orders/detail/intake-detail-header.tsx` | title row, badges, action buttons |
| `features/intake-orders/detail/intake-status-bar.tsx` | the office's four-segment status correction |
| `features/intake-orders/detail/intake-draft-bar.tsx` | the amber unfinished bar with resume/discard |
| `features/intake-orders/detail/intake-removed-bar.tsx` | the removed bar with restore |
| `features/intake-orders/detail/intake-detail-tabs.tsx` | the four tab buttons, driven by the URL |
| `features/intake-orders/detail/tab-overview.tsx` | facts, map + damages, condition card, photo rail, signatures |
| `features/intake-orders/detail/tab-photos.tsx` | the 4-column photo grid |
| `features/intake-orders/detail/tab-spec.tsx` | the editable services/materials lists |
| `features/intake-orders/detail/tab-history.tsx` | the projected history rows |
| `features/intake-orders/detail/history-labels.ts` | transition → message lookup |
| `routes/_shell/prijem/$id.tsx` | loader, guards, composition |

---

# V-6-1a — Server

## Task 1: History shows post-signing edits, and nothing else

The filter and the new transition ship together: without `spec_updated` the filter deletes the one edit V-6-1 newly allows on a signed order (spec §6.1).

**Files:**
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts` (the `update` audit, around :252-262)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.repository.ts` (`listHistory`, around :594)
- Test: `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts` (the `history` describe, around :487)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the transition string `'spec_updated'`, consumed by Task 11's `history-labels.ts`.

- [ ] **Step 1: Write the failing tests**

Add inside `describe('history', ...)`:

```ts
it('keeps a post-signing services edit — the one edit a signed order still allows', async () => {
  const actor = await floorActor()
  const id = await signedOrder(actor)

  await service.update(id, { services: ['Zamena filtera'] }, actor, actorContext(actor.id))

  const history = await service.listHistory(id, actor)
  const specRows = history.filter((row) => row.transition === 'spec_updated')
  expect(specRows).toHaveLength(1)
})

it('leaves the wizard out of the story — filling an intake in is not a change to it', async () => {
  const actor = await floorActor()
  const created = await service.create(createInput(), actorContext(actor.id))
  await service.update(created.id, { draftStep: 2 }, actor, actorContext(actor.id))
  await service.update(created.id, { fuelLevel: 5 }, actor, actorContext(actor.id))

  const history = await service.listHistory(created.id, actor)
  expect(history).toHaveLength(1)
  expect(history[0]?.action).toBe('create')
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter api test:integration -- -t 'history'`
Expected: FAIL — the first finds 0 `spec_updated` rows, the second finds 3 rows instead of 1.

- [ ] **Step 3: Write the transition**

In `intake-orders.service.ts`, above the class, add the helper (no nested ternary — CLAUDE.md §6):

```ts
/**
 * A patch of a SIGNED order is either an amendment of the condition or an edit of the two
 * fields that stay free (services, materials). The free edit still has to reach the Istorija
 * tab — it is the only change a signed work order allows — so it is tagged rather than left
 * transition-less, which is the shape the history projection drops (docs/25 V-6-1 §6.1).
 */
function updateTransition(signed: boolean, isAmendment: boolean): string | null {
  if (isAmendment) {
    return 'amend_after_signing'
  }
  if (signed) {
    return 'spec_updated'
  }
  return null
}
```

Then replace the `changes:` expression inside `update`:

```ts
const transition = updateTransition(before.signedAt !== null, isAmendment)

await this.audit.log({
  entityType: 'intake_order',
  entityId: id,
  action: AuditAction.Update,
  actorUserId: auditContext.actorUserId,
  actorIp: auditContext.actorIp,
  actorUserAgent: auditContext.actorUserAgent,
  changes: transition === null ? { before, after: updated } : { before, after: updated, transition },
})
```

- [ ] **Step 4: Write the filter**

In `intake-orders.repository.ts`, in `listHistory`, add to the `.where(...)`:

```ts
.where(
  and(
    eq(auditLog.entityType, 'intake_order'),
    eq(auditLog.entityId, orderId),
    // The intake being filled in is not a change TO the intake: the wizard's own step
    // patches carry no transition, and a photo that arrives or is retaken before the
    // signature is the same intake still in progress. Keyed on the transition, not the
    // action — a photo removal audits as Delete, so "keep every delete" would keep it.
    sql`NOT (
      ${auditLog.changes}->>'transition' IN ('photo_uploaded', 'photo_removed')
      OR (${auditLog.action} = 'update' AND ${auditLog.changes}->>'transition' IS NULL)
    )`,
  ),
)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter api test:integration -- -t 'history'`
Expected: PASS, including the pre-existing `tells the story of the order in the order it happened, newest first` — if that one now fails, read it: its expectations may have counted wizard rows, in which case update the expectation and say so in the commit body.

- [ ] **Step 6: Correct the stale paragraph in `CLAUDE.md` §5**

Spec §9.4. The bullet about `var(--mri-<status-hue>)` ends with:

> Two more instances are still open in `intake-damage-map.tsx` (`--mri-warn`, `--mri-archived`), not yet on screen.

They were fixed in V-4c-0 (`5dee824`) — `intake-damage-map.tsx:25-33` now returns `--mri-amb` /
`--mri-gry`, and the file's own comment describes the bug in the past tense. Delete that sentence
and replace it with:

> Both instances in `intake-damage-map.tsx` were fixed in V-4c-0 (`5dee824`); the pattern is the thing to keep recognising, not the file.

- [ ] **Step 7: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/api/src/modules/intake-orders/intake-orders.service.ts apps/api/src/modules/intake-orders/intake-orders.repository.ts apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts CLAUDE.md
git commit -m "feat(api): the intake history keeps what changed after the signature, and drops the filling in (docs/25 V-6-1a)"
```

---

## Task 2: An unfinished intake is its own serviser's

**Files:**
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts`
- Test: `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts` (the `the freeze after signing` describe, around :251)

**Interfaces:**
- Consumes: `loadVisible(id, actor)`, `IntakeOrdersActor { id, permissions }` (`intake-orders.types.ts`).
- Produces: `assertDraftOwner(order, actor)` — private; and the 403 contract Task 12's wizard guards rely on.

- [ ] **Step 1: Write the failing tests**

```ts
describe('an unfinished intake belongs to its serviser', () => {
  it('refuses the office on every mutating path while the intake is unsigned', async () => {
    const serviser = await floorActor()
    const office = await officeActor()
    const created = await service.create(createInput(), actorContext(serviser.id))

    await expect(
      service.update(created.id, { fuelLevel: 4 }, office, actorContext(office.id)),
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      service.sign(
        created.id,
        { technicianSignature: 'M 0 0 L 1 1', ownerSignature: 'M 0 0 L 1 1', photosExpected: 0 },
        office,
        actorContext(office.id),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      service.uploadPhoto(created.id, photoInput(), null, office, actorContext(office.id)),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('still lets the office throw an abandoned draft away', async () => {
    const serviser = await floorActor()
    const office = await officeActor()
    const created = await service.create(createInput(), actorContext(serviser.id))

    await expect(
      service.delete(created.id, office, actorContext(office.id)),
    ).resolves.toBeUndefined()
  })

  it('leaves the owning serviser free on his own draft', async () => {
    const serviser = await floorActor()
    const created = await service.create(createInput(), actorContext(serviser.id))

    const updated = await service.update(
      created.id,
      { fuelLevel: 4 },
      serviser,
      actorContext(serviser.id),
    )
    expect(updated.fuelLevel).toBe(4)
  })
})
```

`photoInput()` — reuse the existing helper the `photos` describe already uses; if it is inline there, lift it to a module-level helper beside `createInput` in the same step.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter api test:integration -- -t 'belongs to its serviser'`
Expected: FAIL — the first three calls resolve instead of rejecting.

- [ ] **Step 3: Write the guard**

In `intake-orders.service.ts`, beside `loadVisible`:

```ts
/**
 * An unfinished intake may only be moved forward by the serviser who started it. Until now the
 * rule lived only in the wizard's UI, while the server accepted the patch from anyone holding
 * `intake_orders.update` — and V-6 adds a typeable second entrance to that draft
 * (`/prijem/novi?resume=<id>`), so the gap stops being theoretical.
 *
 * 403, not 404: the row scope has already spoken. A serviser reaching for a colleague's draft
 * never gets here — `loadVisible` gave him a 404 — so the only caller this can refuse is an
 * office actor who legitimately knows the order exists.
 *
 * `delete` is deliberately NOT guarded: the office throwing away the draft of a serviser who
 * left the firm is a rule of its own (docs/25 §3.3.5).
 */
private assertDraftOwner(order: IntakeOrderDetail, actor: IntakeOrdersActor): void {
  if (order.signedAt !== null) {
    return
  }
  if (order.technicianId === actor.id) {
    return
  }
  throw new ForbiddenError('An unfinished intake can only be continued by its own serviser')
}
```

Call it immediately after each `loadVisible` in `update`, `sign`, `uploadPhoto` and `deletePhoto`:

```ts
const before = await this.loadVisible(id, actor)
this.assertDraftOwner(before, actor)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test:integration -- -t 'belongs to its serviser'`
Expected: PASS.

- [ ] **Step 5: Run the whole intake suite**

Run: `pnpm --filter api test:integration -- -t 'Intake orders integration'`
Expected: PASS. **No existing test exercises a non-owner mutating a draft** (spec §6.2), so nothing should go red here. If something does, it is a finding — investigate it, do not "align the actor".

- [ ] **Step 6: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/api/src/modules/intake-orders/intake-orders.service.ts apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts
git commit -m "fix(api): an unfinished intake is its own serviser's, on the server and not only on screen (docs/25 V-6-1a)"
```

---

## Task 3: The missing-photo indicator survives an amendment

**Files:**
- Modify: `apps/api/src/modules/intake-orders/intake-orders.repository.ts` (a new `shiftPhotosExpected`)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts` (`uploadPhoto`, `deletePhoto`)
- Test: `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts` (the `photos` describe, around :541)

**Interfaces:**
- Consumes: the existing `isAmendment` branch in both photo paths.
- Produces: `shiftPhotosExpected(orderId: string, delta: number): Promise<void>` on the repository.

- [ ] **Step 1: Write the failing tests**

```ts
it('keeps the missing-photo count meaning one thing when the office amends', async () => {
  const serviser = await floorActor()
  const office = await officeActor()
  const id = await signedOrderExpecting(serviser, 3) // signed with photosExpected: 3, 0 arrived

  await service.uploadPhoto(id, photoInput(), null, office, actorContext(office.id))

  const afterAdd = await service.findById(id, office)
  expect(afterAdd.photosPending).toBe(3)

  const photo = afterAdd.photos[0]
  expect(photo).toBeDefined()
  await service.deletePhoto(id, photo!.id, office, actorContext(office.id))

  const afterRemove = await service.findById(id, office)
  expect(afterRemove.photosPending).toBe(3)
})

it('never drives photos_expected below zero, whatever the office removes', async () => {
  const serviser = await floorActor()
  const office = await officeActor()
  const id = await signedOrderExpecting(serviser, 0)

  await service.uploadPhoto(id, photoInput(), null, office, actorContext(office.id))
  const detail = await service.findById(id, office)
  const photo = detail.photos[0]
  expect(photo).toBeDefined()

  // expected is 1 after the add; removing takes it to 0, and a second removal must not
  // try to take it to -1 and hit intake_orders_photos_expected_check.
  await expect(
    service.deletePhoto(id, photo!.id, office, actorContext(office.id)),
  ).resolves.toBeUndefined()
  const after = await service.findById(id, office)
  expect(after.photosPending).toBe(0)
})
```

Add the helper beside `signedOrder`:

```ts
async function signedOrderExpecting(
  actor: IntakeOrdersActor,
  photosExpected: number,
): Promise<string> {
  const created = await service.create(createInput(), actorContext(actor.id))
  await service.sign(
    created.id,
    { technicianSignature: 'M 0 0 L 10 10', ownerSignature: 'M 5 5 L 20 20', photosExpected },
    actor,
    actorContext(actor.id),
  )
  return created.id
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter api test:integration -- -t 'missing-photo count'`
Expected: FAIL — `photosPending` drops to 2 after the office's add.

- [ ] **Step 3: Write the repository method**

In `intake-orders.repository.ts`:

```ts
/**
 * `photos_expected` is what the tablet held at signing, so the indicator means "photos that
 * never arrived". An office amendment must move the expectation with it, or removing a bad
 * photo would claim photos were lost and adding one would silence a real loss.
 *
 * Floored in SQL: the column is nullable and carries `photos_expected >= 0`
 * (intake_orders_photos_expected_check). It can legitimately already sit below the arrived
 * count — a retry that lands twice, a stale count at signing — and `pendingPhotoCount` clamps
 * that away, so a bare decrement would walk it under zero and raise a raw constraint error.
 */
async shiftPhotosExpected(orderId: string, delta: number): Promise<void> {
  await this.db
    .update(intakeOrders)
    .set({
      photosExpected: sql`GREATEST(0, COALESCE(${intakeOrders.photosExpected}, 0) + ${delta})`,
    })
    .where(and(eq(intakeOrders.id, orderId), isNull(intakeOrders.deletedAt)))
}
```

- [ ] **Step 4: Call it from both photo paths**

In `uploadPhoto`, inside the existing `if (isAmendment)` block:

```ts
if (isAmendment) {
  await this.repo.update(id, {}, auditContext.actorUserId)
  await this.repo.shiftPhotosExpected(id, 1)
}
```

In `deletePhoto`, inside its `if (isAmendment)` block:

```ts
if (isAmendment) {
  await this.repo.update(id, {}, auditContext.actorUserId)
  await this.repo.shiftPhotosExpected(id, -1)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter api test:integration -- -t 'photos'`
Expected: PASS, whole `photos` describe included.

- [ ] **Step 6: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/api/src/modules/intake-orders
git commit -m "fix(api): an office amendment moves the photo expectation with it (docs/25 V-6-1a)"
```

---

## Task 4: A removed order can be read, and put back

**Files:**
- Modify: `packages/shared/src/schemas/intake-order.wire.schema.ts` (`deletedAt` on `IntakeOrderDetailSchema`)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.repository.ts` (`detailSelection` :173, `mapDetail` :130, `findById` :211, a new `restore`, the number lookup)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts` (`loadVisible`, `assertNotDeleted`, `restore`)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.controller.ts`, `.routes.ts`
- Modify: `apps/api/src/core/errors/domain-errors.ts`, `apps/api/src/core/middleware/error-handler.ts`
- Modify: `packages/shared/src/queries/intake-orders.ts` (`restoreIntakeOrder`)
- Test: the intake integration suite, the `removal` and `row-level scope` describes

**Interfaces:**
- Consumes: `mapDetail(row, photos)`, `detailSelection()`, `loadVisible`.
- Produces: `IntakeOrderDetail.deletedAt: string | null` (Task 9 keys the removed bar on it) · `restoreIntakeOrder(id: string): Promise<IntakeOrderDetail>` in `@mr/shared` (Task 9 calls it) · `POST /api/intake-orders/:id/restore`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('restore', () => {
  it('brings a removed order back to the list', async () => {
    const serviser = await floorActor()
    const office = await officeActor()
    const id = await signedOrder(serviser)
    await service.delete(id, office, actorContext(office.id))

    const restored = await service.restore(id, office, actorContext(office.id))
    expect(restored.deletedAt).toBeNull()
  })

  it('lets the office read a removed order while everyone else still gets a 404', async () => {
    const serviser = await floorActor()
    const office = await officeActor()
    const id = await signedOrder(serviser)
    await service.delete(id, office, actorContext(office.id))

    const seen = await service.findById(id, office)
    expect(seen.deletedAt).not.toBeNull()

    await expect(service.findById(id, serviser)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses to restore onto a number somebody else has taken since', async () => {
    const serviser = await floorActor()
    const office = await officeActor()
    const number = uniqueNumber('clash')
    const id = await signedOrder(serviser, { orderNumber: number })
    await service.delete(id, office, actorContext(office.id))

    const replacement = await service.create(
      createInput({ orderNumber: number }),
      actorContext(serviser.id),
    )

    const failure = await service.restore(id, office, actorContext(office.id)).catch((e) => e)
    expect(failure).toBeInstanceOf(ConflictError)
    expect((failure as { details?: unknown }).details).toEqual({ orderId: replacement.id })
  })

  it('refuses a second removal of an order already off the list', async () => {
    const serviser = await floorActor()
    const office = await officeActor()
    const id = await signedOrder(serviser)
    await service.delete(id, office, actorContext(office.id))

    await expect(
      service.delete(id, office, actorContext(office.id)),
    ).rejects.toBeInstanceOf(ConflictError)
  })
})
```

Then **change one existing assertion on purpose.** In `describe('removal')`, the case
`soft-deletes a signed order for the office — evidence leaves the list, not the database`
asserts the office gets a 404 afterwards. That inverts by design: the office is exactly the actor
that must now see it. Move the 404 assertion onto `floorActor()` and leave a comment saying why.
**This is the only test in the phase that may go red on purpose.**

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter api test:integration -- -t 'restore'`
Expected: FAIL — `service.restore` is not a function.

- [ ] **Step 3: Put `deletedAt` on the wire**

In `packages/shared/src/schemas/intake-order.wire.schema.ts`, inside `IntakeOrderDetailSchema`, after `amendedByName`:

```ts
  /**
   * NULL for a live order. Present so the detail can tell a removed order from a live one —
   * without it the screen would have to infer the state from which list the user arrived
   * through, and would draw the action row on an order that is off the list.
   */
  deletedAt: z.string().nullable(),
```

In `intake-orders.repository.ts`, add `deletedAt: intakeOrders.deletedAt` to `detailSelection()` and map it in `mapDetail`:

```ts
    deletedAt: row.deletedAt === null ? null : row.deletedAt.toISOString(),
```

- [ ] **Step 4: Let the repository read and clear a removed row**

```ts
async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<IntakeOrderDetail | null> {
  const conditions = [eq(intakeOrders.id, id)]
  if (options.includeDeleted !== true) {
    conditions.push(isNull(intakeOrders.deletedAt))
  }
  // ...existing body, with .where(and(...conditions))
}

/** Puts a removed order back on the list. The caller has already proven the number is free. */
async restore(id: string): Promise<void> {
  await this.db
    .update(intakeOrders)
    .set({ deletedAt: null })
    .where(and(eq(intakeOrders.id, id), isNotNull(intakeOrders.deletedAt)))
}

/** The live order holding this number, if any — restore has to be able to lose that race. */
async findLiveByNumberKey(numberKey: string): Promise<{ id: string } | null> {
  const [row] = await this.db
    .select({ id: intakeOrders.id })
    .from(intakeOrders)
    .where(and(eq(intakeOrders.orderNumberKey, numberKey), isNull(intakeOrders.deletedAt)))
    .limit(1)
  return row ?? null
}
```

- [ ] **Step 5: Give `ConflictError` a payload**

In `apps/api/src/core/errors/domain-errors.ts`, add a `details` field to `ConflictError` (optional, so every existing throw still compiles):

```ts
export class ConflictError extends DomainError {
  readonly details: Record<string, unknown> | undefined

  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.details = details
  }
}
```

In `apps/api/src/core/middleware/error-handler.ts`, in the `ConflictError` branch, include it in the envelope when present — follow the shape the MR-number conflict already uses so `ApiError.details` reaches the browser. Read the existing branch before editing; do not invent a second envelope shape.

- [ ] **Step 6: Write the service methods**

```ts
/** A removed order is read-only until it is put back — anything else fabricates history. */
private assertNotDeleted(order: IntakeOrderDetail): void {
  if (order.deletedAt === null) {
    return
  }
  throw new ConflictError('Intake order is removed from the list — restore it first')
}
```

Call `assertNotDeleted` after `loadVisible` in `update`, `sign`, `advance`, `changeStatus`,
`uploadPhoto`, `deletePhoto` **and `delete`**. Do **not** call it in `restore`, `findById` or
`listHistory`.

Widen `loadVisible` so the office can read a removed order:

```ts
private async loadVisible(id: string, actor: IntakeOrdersActor): Promise<IntakeOrderDetail> {
  const scope = resolveScope(actor)
  const order = await this.repo.findById(id, {
    includeDeleted: actor.permissions.includes('intake_orders.delete'),
  })
  // ...unchanged from here
}
```

And the restore itself:

```ts
async restore(
  id: string,
  actor: IntakeOrdersActor,
  auditContext: HttpActorContext,
): Promise<IntakeOrderDetail> {
  const before = await this.loadVisible(id, actor)
  if (before.deletedAt === null) {
    return before
  }

  // Removing an order releases its number: the unique index is partial on live rows. So the
  // number may be somebody else's by now, and the database would answer that with a raw
  // 23505 rather than something the office can act on.
  const clash = await this.repo.findLiveByNumberKey(normalizeOrderNumberKey(before.orderNumber))
  if (clash !== null) {
    throw new ConflictError('That order number is in use by a live order', { orderId: clash.id })
  }

  await this.repo.restore(id)
  const restored = await this.repo.findById(id)
  if (restored === null) {
    throw new NotFoundError('Intake order', id)
  }

  await this.audit.log({
    entityType: 'intake_order',
    entityId: id,
    action: AuditAction.Update,
    actorUserId: auditContext.actorUserId,
    actorIp: auditContext.actorIp,
    actorUserAgent: auditContext.actorUserAgent,
    changes: { before, after: restored, transition: 'restore' },
  })

  this.signalChanged()
  return restored
}
```

Use whatever the module already calls its key normaliser — check the `create` path for the exact
name before writing `normalizeOrderNumberKey`.

- [ ] **Step 7: Wire the endpoint**

Controller:

```ts
restore: async (c: Context) => {
  const id = uuidParam(c)
  const order = await container.intakeOrdersService.restore(id, actorOf(c), auditContextOf(c))
  return c.json(order)
},
```

Route, beside the delete:

```ts
// Whoever may remove may put back — the office corrects its own mistakes rather than
// living with a one-way delete (docs/25 V-6-1 §6.4).
routes.post('/:id/restore', requirePermission('intake_orders.delete'), controller.restore)
```

Use the module's existing helpers for the id parse and the actor/audit context — copy the shape
from `controller.delete` rather than inventing names.

Shared client, beside `deleteIntakeOrder`:

```ts
export function restoreIntakeOrder(id: string): Promise<IntakeOrderDetail> {
  return fetchParsed(`/api/intake-orders/${id}/restore`, IntakeOrderDetailSchema, {
    method: 'POST',
  })
}
```

Match the exact call shape of the neighbouring mutations in that file.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter api test:integration -- -t 'Intake orders integration'`
Expected: PASS, including the deliberately inverted assertion from Step 1.

- [ ] **Step 9: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/api packages/shared
git commit -m "feat(api): a removed intake can be read and put back — delete stops being a one-way door (docs/25 V-6-1a)"
```

---

## Task 5: The list asks for a view, not a flag

Includes the UI select: the rename is a compile break in `index.tsx` and `intake-filter-bar.tsx`, so leaving them behind would make this pass fail its own gate (spec §6.5).

**Files:**
- Modify: `packages/shared/src/schemas/intake-order.wire.schema.ts` (`IntakeOrderListQuerySchema`, `IntakeOrdersSearch`)
- Modify: `packages/shared/src/queries/intake-orders.ts` (`IntakeOrderListFilters` :35, `intakeFiltersFromSearch` :44, the query builder :74)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.repository.ts` (`scopeCondition` :250)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts` (`list`)
- Modify: `apps/internal-web/src/routes/_shell/prijem/index.tsx` (:114, :117), `features/intake-orders/intake-filter-bar.tsx`
- Modify: `packages/i18n/src/messages/{sr,en}.json`
- Test: the intake integration suite, the `unfinished intakes` describe

**Interfaces:**
- Consumes: `IntakeOrdersListScope` from `intake-orders.types.ts`.
- Produces: `IntakeOrderListView = 'active' | 'unfinished' | 'deleted'` exported from `@mr/shared`; the `view` search param Task 9's back-links use.

- [ ] **Step 1: Write the failing tests**

```ts
it("still gives a serviser his own drafts under the default view", async () => {
  const serviser = await floorActor()
  await service.create(createInput(), actorContext(serviser.id))

  const list = await service.list(serviser, { view: 'active', page: 1, pageSize: 25 })
  expect(list.items).toHaveLength(1)
  expect(list.items[0]?.signedAt).toBeNull()
})

it('shows the office removed orders only when it asks, and only with delete', async () => {
  const serviser = await floorActor()
  const office = await officeActor()
  const id = await signedOrder(serviser)
  await service.delete(id, office, actorContext(office.id))

  const removed = await service.list(office, { view: 'deleted', page: 1, pageSize: 25 })
  expect(removed.items.map((row) => row.id)).toContain(id)

  await expect(
    service.list(serviser, { view: 'deleted', page: 1, pageSize: 25 }),
  ).rejects.toBeInstanceOf(ForbiddenError)
})
```

Match the exact `IntakeOrderListQuery` shape the suite already builds — read a neighbouring call
first; the schema has defaults these literals must satisfy.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter api test:integration -- -t 'default view'`
Expected: FAIL — `view` is not a property of the query type.

- [ ] **Step 3: Change the shared schema**

```ts
export const intakeOrderListViewValues = ['active', 'unfinished', 'deleted'] as const
export type IntakeOrderListView = (typeof intakeOrderListViewValues)[number]
```

In `IntakeOrderListQuerySchema` replace `unfinished: boolQueryParam.default(false)` with
`view: z.enum(intakeOrderListViewValues).default('active')`, and in `IntakeOrdersSearch` replace
`unfinished: z.boolean().optional()` with `view: z.enum(intakeOrderListViewValues).optional()`.

In `packages/shared/src/queries/intake-orders.ts`: `IntakeOrderListFilters.unfinished?: boolean`
becomes `view?: IntakeOrderListView`; `intakeFiltersFromSearch` passes it through the same way; and
the query-string builder writes `query.set('view', filters.view)` when it is set and not `'active'`.

- [ ] **Step 4: Change the repository, keeping the serviser's exemption**

```ts
/**
 * Scope and visibility in one predicate. The fork is the point: an `own` scope returns every
 * live row of the caller, drafts included, and never reads the view — it is his own unfinished
 * work and hiding it would take away the only way back into it. Only the office's `all` scope
 * narrows.
 */
private scopeCondition(scope: IntakeOrdersListScope, view: IntakeOrderListView) {
  if (scope.type === 'own') {
    return and(isNull(intakeOrders.deletedAt), eq(intakeOrders.technicianId, scope.userId))
  }

  if (view === 'deleted') {
    return and(isNotNull(intakeOrders.deletedAt), isNotNull(intakeOrders.signedAt))
  }

  const live = isNull(intakeOrders.deletedAt)
  return view === 'unfinished'
    ? and(live, isNull(intakeOrders.signedAt))
    : and(live, isNotNull(intakeOrders.signedAt))
}
```

In `list`, pass `query.view` instead of `query.unfinished`.

- [ ] **Step 5: Refuse the removed view without the permission**

At the top of `IntakeOrdersService.list`:

```ts
if (query.view === 'deleted' && !actor.permissions.includes('intake_orders.delete')) {
  throw new ForbiddenError('Reading removed intake orders requires delete')
}
```

- [ ] **Step 6: Replace the checkbox with the select**

In `intake-filter-bar.tsx`, swap the `showUnfinishedToggle` checkbox for a `<select>` in the same
slot, keeping `min-h-11` and `flex-none` so the measured bar layout does not move:

```tsx
{showViewSelect ? (
  <label className="flex min-h-11 flex-none items-center gap-2 text-[12.5px] font-semibold text-mri-text2">
    {m.intake_filter_view()}
    <select
      value={view}
      onChange={(event) => onViewChange(event.target.value as IntakeOrderListView)}
      className="h-11 rounded-[9px] border border-mri-border2 bg-mri-inbg px-2.5 text-mri-text"
    >
      <option value="active">{m.intake_filter_view_active()}</option>
      <option value="unfinished">{m.intake_filter_view_unfinished()}</option>
      <option value="deleted">{m.intake_filter_view_deleted()}</option>
    </select>
  </label>
) : null}
```

In `index.tsx` replace `search.unfinished === true` (:114) and the `onUnfinishedChange` handler
(:117) with `search.view ?? 'active'` and `patchSearch({ view: value === 'active' ? undefined : value })`.

i18n — add to **both** message files, then run `pnpm --filter @mr/i18n run compile`:

```json
"intake_filter_view": "Prikaz",
"intake_filter_view_active": "Aktivni",
"intake_filter_view_unfinished": "Nedovršeni",
"intake_filter_view_deleted": "Uklonjeni"
```

English: `"View"`, `"Active"`, `"Unfinished"`, `"Removed"`. Delete `intake_filter_unfinished` from
both files — nothing else references it once `index.tsx` is updated (grep to confirm).

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter api test:integration -- -t 'Intake orders integration'` then
`pnpm --filter internal-web test`
Expected: PASS both.

- [ ] **Step 8: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps packages
git commit -m "feat(intake): the list asks for a view — active, unfinished or removed (docs/25 V-6-1a)"
```

**V-6-1a is done here. Report the gate result before starting Task 6.**

---

# V-6-1b — Screen

## Task 6: Groundwork the screen needs

**Files:**
- Create: `apps/internal-web/src/features/intake-orders/intake-labels.ts`
- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-checklist-grid.tsx` (its private `ITEM_LABELS` at :6)
- Modify: `apps/internal-web/src/features/intake-orders/intake-status.ts`
- Modify: `packages/shared/src/schemas/intake-order.wire.schema.ts` (`IntakeDetailSearchSchema`)
- Test: `apps/internal-web/src/features/intake-orders/__tests__/intake-labels.test.ts`

**Interfaces:**
- Produces: `INTAKE_CHECKLIST_LABELS: Record<IntakeChecklistKey, () => string>` · `INTAKE_VEHICLE_TYPE_LABELS` · `INTAKE_ARRIVAL_MODE_LABELS` · `formatIntakeReceivedAtLong(iso: string, locale: string): string` · `IntakeDetailSearchSchema` with `tab: 'pregled' | 'fotografije' | 'spec' | 'istorija'`.

- [ ] **Step 1: Write the failing test**

```ts
import { INTAKE_CHECKLIST_KEYS } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { INTAKE_CHECKLIST_LABELS } from '../intake-labels'
import { formatIntakeReceivedAtLong } from '../intake-status'

describe('intake labels', () => {
  it('names every checklist item exactly once', () => {
    for (const key of INTAKE_CHECKLIST_KEYS) {
      expect(INTAKE_CHECKLIST_LABELS[key]()).not.toBe('')
    }
  })

  it('carries the year, because the detail is read years later', () => {
    expect(formatIntakeReceivedAtLong('2026-07-25T07:14:00.000Z', 'sr')).toMatch(/2026/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter internal-web test -- intake-labels`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the labels module**

Move the `ITEM_LABELS` object out of `intake-checklist-grid.tsx:6` into
`features/intake-orders/intake-labels.ts` as `INTAKE_CHECKLIST_LABELS`, and add the two enum maps
the detail's facts and header need (`IntakeVehicleType` → `m.intake_vehicle_*`,
`IntakeArrivalMode` → the existing `m.intake_arrival_*` keys). Import it back into
`intake-checklist-grid.tsx` so there is one copy, not three.

```ts
/**
 * Label maps shared by the wizard and the detail. They lived private inside the wizard's
 * components; the detail needs the same words, and a second copy means a rename updates one
 * screen and silently not the other.
 */
export const INTAKE_CHECKLIST_LABELS: Record<IntakeChecklistKey, () => string> = {
  // ...the eight entries moved verbatim from intake-checklist-grid.tsx
}
```

- [ ] **Step 4: Add the long date format**

In `intake-status.ts`, beside `formatIntakeReceivedAt`:

```ts
/**
 * `25.07.2026 · 09:14` — the detail's format. The list's short one drops the year, which is
 * fine for a work list and wrong for an archival read that is reachable from `Uklonjeni`, from
 * a direct link and later from the print.
 */
export function formatIntakeReceivedAtLong(iso: string, locale: string): string {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${day} · ${time}`
}
```

- [ ] **Step 5: Add the tab search schema**

In `packages/shared/src/schemas/intake-order.wire.schema.ts`, modelled on `ClaimDetailSearchSchema`:

```ts
export const intakeDetailTabValues = ['pregled', 'fotografije', 'spec', 'istorija'] as const
export type IntakeDetailTab = (typeof intakeDetailTabValues)[number]

export const IntakeDetailSearchSchema = z.object({
  tab: z.enum(intakeDetailTabValues).default('pregled'),
})
```

- [ ] **Step 6: Run the test, then gate and commit**

Run: `pnpm --filter internal-web test -- intake-labels`
Expected: PASS.

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web packages/shared
git commit -m "refactor(intake): lift the label maps and add the detail's date format and tab schema (docs/25 V-6-1b)"
```

---

## Task 7: Make the spec list and the lightbox reusable

Both are pure extractions from shipped V-4c/V-5 files. Nothing about the wizard may change.

**Files:**
- Modify: `apps/internal-web/src/features/intake-orders/wizard/step-specification.tsx` (export `SpecList` as `IntakeSpecList`, add optional `note`)
- Create: `apps/internal-web/src/features/intake-orders/wizard/intake-photo-lightbox.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/wizard/step-damage-photos.tsx` (:66 state, :268-315 overlay → render the extracted component)
- Test: `apps/internal-web/src/features/intake-orders/wizard/__tests__/step-specification.test.tsx` (existing, must stay green), `.../step-damage-photos.test.tsx` (existing, must stay green)

**Interfaces:**
- Produces: `IntakeSpecList({ title, items, placeholder, removeLabel, onChange, note? })` · `IntakePhotoLightbox({ cell, orderId, onClose, onDelete? })` — Task 10 and Task 11 render both.

- [ ] **Step 1: Run the existing wizard tests and record the baseline**

Run: `pnpm --filter internal-web test -- step-specification step-damage-photos`
Expected: PASS. Note the counts — they must be identical after the extraction.

- [ ] **Step 2: Export the spec list**

In `step-specification.tsx`, rename `function SpecList` to `export function IntakeSpecList`, and
make its note optional so the detail can leave it out:

```tsx
export interface IntakeSpecListProps {
  title: string
  items: readonly string[]
  placeholder: string
  removeLabel: string
  onChange: (items: string[]) => void
  /** Only the wizard's materials card carries one, pinned to the bottom, as the prototype has it. */
  note?: string
}
```

Render the note only when defined. `StepSpecification` keeps passing `note={m.intake_spec_note()}`
on the materials card, so nothing about the wizard changes.

- [ ] **Step 3: Extract the lightbox**

Move the `role="dialog"` overlay out of `step-damage-photos.tsx` into
`wizard/intake-photo-lightbox.tsx` verbatim — same classes, same markup — with the delete button
behind an optional prop:

```tsx
export interface IntakePhotoLightboxProps {
  cell: IntakePhotoCell
  orderId: string
  onClose: () => void
  /** Omitted on the detail: removing a photo after signing is V-6-2. */
  onDelete?: (attachmentId: string) => Promise<void>
}
```

`step-damage-photos.tsx` keeps its `preview` state and renders
`<IntakePhotoLightbox cell={preview} orderId={orderId} onClose={...} onDelete={onDeletePhoto} />`.

- [ ] **Step 4: Run the wizard tests again**

Run: `pnpm --filter internal-web test -- step-specification step-damage-photos`
Expected: PASS with the same counts as Step 1. A changed count means behaviour moved — investigate.

- [ ] **Step 5: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src/features/intake-orders/wizard
git commit -m "refactor(intake): the spec list and the photo lightbox become reusable, unchanged (docs/25 V-6-1b)"
```

---

## Task 8: The damage map gets a detail variant

**Files:**
- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-damage-map.tsx`
- Test: `apps/internal-web/src/features/intake-orders/wizard/__tests__/intake-damage-map.test.tsx`

**Interfaces:**
- Produces: `IntakeDamageMapProps.variant?: 'wizard' | 'detail'` — Task 10 passes `'detail'`.

- [ ] **Step 1: Write the failing test**

```ts
it('drops the orientation words on the detail, where 9px would be an illegible smudge', () => {
  const { queryByText, rerender } = render(
    <IntakeDamageMap vehicleType={IntakeVehicleType.Car} damages={[]} />,
  )
  expect(queryByText(m.intake_map_front())).not.toBeNull()

  rerender(<IntakeDamageMap vehicleType={IntakeVehicleType.Car} damages={[]} variant="detail" />)
  expect(queryByText(m.intake_map_front())).toBeNull()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter internal-web test -- intake-damage-map`
Expected: FAIL — `variant` is not a prop.

- [ ] **Step 3: Add the variant**

```tsx
/** The wizard draws at 236×386 with orientation words; the detail at the prototype's 152×248
 *  without them — at that size the 9px labels render around 4px, which is a smudge, and the
 *  prototype's detail map draws silhouette and markers only. */
const MAP_SIZE = {
  wizard: { width: 236, height: 386, orientation: true },
  detail: { width: 152, height: 248, orientation: false },
} as const
```

Take `variant: 'wizard' | 'detail' = 'wizard'` in the props, read `MAP_SIZE[variant]` for the
`width`/`height` attributes, and render the orientation `<g>` only when `orientation` is true.

- [ ] **Step 4: Run the test, then gate and commit**

Run: `pnpm --filter internal-web test -- intake-damage-map`
Expected: PASS.

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src/features/intake-orders/wizard/intake-damage-map.tsx apps/internal-web/src/features/intake-orders/wizard/__tests__/intake-damage-map.test.tsx
git commit -m "feat(intake): the damage map draws a detail-sized variant (docs/25 V-6-1b)"
```

---

## Task 9: The detail's shell — route, header, bars, tabs

**Files:**
- Modify: `apps/internal-web/src/routes/_shell/prijem/$id.tsx`
- Create: `features/intake-orders/detail/intake-detail-header.tsx`, `intake-status-bar.tsx`, `intake-draft-bar.tsx`, `intake-removed-bar.tsx`, `intake-detail-tabs.tsx`
- Test: `features/intake-orders/detail/__tests__/intake-detail-header.test.tsx`, `.../intake-draft-bar.test.tsx`

**Interfaces:**
- Consumes: `IntakeDetailSearchSchema` (Task 6), `deletedAt` + `restoreIntakeOrder` (Task 4), `IntakeOrderListView` (Task 5), `formatIntakeReceivedAtLong` (Task 6).
- Produces: the route's composition point that Tasks 10–11 mount their tabs into.

- [ ] **Step 1: Write the failing tests**

```tsx
it('offers NASTAVI PRIJEM only to the serviser whose intake it is', () => {
  const draft = { ...unsignedOrder, technicianId: 'user-1', draftStep: 3 }

  const mine = render(<IntakeDraftBar order={draft} currentUserId="user-1" canDelete={false} />)
  expect(mine.queryByRole('link', { name: m.intake_draft_resume() })).not.toBeNull()

  const theirs = render(<IntakeDraftBar order={draft} currentUserId="user-2" canDelete />)
  expect(theirs.queryByRole('link', { name: m.intake_draft_resume() })).toBeNull()
})

it('shows the amended pill only on an amended order', () => {
  const clean = render(<IntakeDetailHeader order={signedOrderFixture} {...noPerms} />)
  expect(clean.queryByText(m.intake_detail_amended_badge())).toBeNull()

  const amended = render(
    <IntakeDetailHeader
      order={{ ...signedOrderFixture, amendedAt: '2026-07-28T10:00:00.000Z', amendedByName: 'Kancelarija' }}
      {...noPerms}
    />,
  )
  expect(amended.queryByText(m.intake_detail_amended_badge())).not.toBeNull()
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter internal-web test -- detail`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the route**

Follow `routes/_shell/reklamacije/emotive/$id.tsx` exactly — same `beforeLoad` / `validateSearch` /
`loader` / `pendingComponent` / `errorComponent` shape:

```tsx
export const Route = createFileRoute('/_shell/prijem/$id')({
  beforeLoad: internalRequireIntakeOrdersView(),
  validateSearch: (search) => IntakeDetailSearchSchema.parse(search),
  loader: async ({ context: { queryClient }, params: { id } }) => {
    // One aggregate fetch; the history is one tab out of four and loads when that tab mounts.
    await queryClient.ensureQueryData(intakeOrderDetailOptions(id))
  },
  component: IntakeDetailPage,
  pendingComponent: IntakeDetailPending,
  errorComponent: IntakeDetailError,
})
```

`internalRequireIntakeOrdersView` — reuse the guard the list route already uses; read
`~/lib/auth-guard.ts` for its exact name rather than inventing one.

The error component distinguishes 404 (`error instanceof ApiError && error.status === 404`) from a
real error, with a back link to `/prijem`, exactly as the claim detail does.

- [ ] **Step 4: Write the header**

Prototype lines 423–448. Back link (mono 11px, `text-mri-text2`), order number
`font-mono text-[27px] font-extrabold tracking-[-0.02em]`, status pill from `INTAKE_STATUS_TONES`,
a vehicle-type pill, the amended pill (amber, only when `amendedAt !== null`), subtitle
`vehicle · PLATE · ownerName` with the plate in mono. Actions on the right, `h-[46px]`:

- `⎙ ŠTAMPAJ` — always `disabled`, with `title={m.intake_detail_print_unavailable()}`
- next-status button — rendered when `signedAt !== null && deletedAt === null && canAdvance && nextStatus !== null`
- `UKLONI NALOG` — rendered when `canDelete && signedAt !== null && deletedAt === null`

- [ ] **Step 5: Write the three bars**

- `intake-status-bar.tsx` — prototype 450–460. Caption `ISPRAVKA STATUSA` (**without**
  „(KANCELARIJA)"), four segments from `INTAKE_STATUS_ORDER`, trailing note
  `m.intake_status_bar_note()`. Rendered only when `canChangeStatus && signedAt !== null && deletedAt === null`.
- `intake-draft-bar.tsx` — amber, `m.intake_draft_step({ step, total: 5 })`, a `NASTAVI PRIJEM →`
  `<Link to="/prijem/novi" search={{ resume: order.id }}>` shown only when
  `order.technicianId === currentUserId`, and `ODUSTANI` behind `<ConfirmDialog>` for the owner or
  a `canDelete` holder.
- `intake-removed-bar.tsx` — shown when `deletedAt !== null`: the sentence that the order is off the
  list, and `VRATI NA LISTU` calling `restoreIntakeOrder`, invalidating the detail, the list and the
  summary, and toasting. On a 409 the toast names the clashing order from `ApiError.details`.

- [ ] **Step 6: Write the tabs**

Prototype 462–466. Four buttons, `border-b-2` red on the active one, the photo count appended to
the Fotografije label. The active tab comes from `Route.useSearch()` and a click calls
`navigate({ search: { tab } })`. On a draft render only `pregled` and `fotografije`.

- [ ] **Step 7: Run the tests, then gate and commit**

Run: `pnpm --filter internal-web test -- detail`
Expected: PASS.

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web packages/i18n
git commit -m "feat(intake): the order detail gets its shell — header, bars and tabs (docs/25 V-6-1b)"
```

---

## Task 10: The Pregled tab

**Files:**
- Create: `features/intake-orders/detail/tab-overview.tsx`
- Test: `features/intake-orders/detail/__tests__/tab-overview.test.tsx`

**Interfaces:**
- Consumes: `INTAKE_CHECKLIST_LABELS` (Task 6), `IntakeDamageMap variant="detail"` (Task 8), `IntakePhotoLightbox` (Task 7), `buildIntakePhotoUrl` (`@mr/shared`).

- [ ] **Step 1: Write the failing test**

```tsx
it('reads an unchecked item as unknown, never as "no"', () => {
  const order = {
    ...signedOrderFixture,
    checklist: { ...allTrueChecklist, rezervna: null, dizalica: false },
  }
  const { getByTestId, getByText } = render(<TabOverview order={order} />)

  expect(getByTestId('condition-rezervna')).toHaveTextContent('—')
  expect(getByTestId('condition-dizalica')).toHaveTextContent('✗')
  expect(getByText(m.intake_condition_unchecked({ count: 1 }))).toBeDefined()
})
```

`m.intake_condition_unchecked` must be phrased so no grammatical form depends on the number —
`"Nisu provereni: {count}"`, never `"{count} nisu provereni"`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter internal-web test -- tab-overview`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the left column**

Prototype 480–557.

- `OSNOVNI PODACI` — `grid-cols-4 gap-4`, nine facts in this order: DATUM PRIJEMA
  (`formatIntakeReceivedAtLong`, mono) · SERVISER · KILOMETRAŽA (`{n} km` or `—`, mono) · NAČIN
  DOLASKA · VIN (or `—`, mono) · TELEFON (mono) · GORIVO (`{n}/8`, mono 600) · NEDOSTACI
  (`damages.length`, `text-mri-grn` when 0 else `text-mri-red`) · ADRESA (or `—`).
- `ŠEMA` + `NEDOSTACI I PRIMEDBE` in one card: `<IntakeDamageMap variant="detail" …>` beside a
  numbered damage list (24px circle in the type's colour), the empty state
  `m.intake_detail_no_damage()`, then `PRIMEDBE VLASNIKA` in italic `text-mri-text2`.
- `ZATEČENO STANJE` — the third card. `grid-cols-4` of `✓ / ✗ / —` plus the label from
  `INTAKE_CHECKLIST_LABELS`, each cell carrying `data-testid={`condition-${key}`}`. The header
  appends the unchecked count when it is above zero. Below the grid, `equipmentNote` when present.

- [ ] **Step 4: Build the right rail**

`w-[320px] flex-none`:

- `FOTOGRAFIJE · N` — `grid-cols-3 gap-2`, square thumbnails via
  `buildIntakePhotoUrl(orderId, photo.id, 'thumbnail')`, the damage badge top-left, click opens
  `IntakePhotoLightbox` with **no** `onDelete`.
- `POTPISI` — two 50px boxes, each `<svg viewBox="0 0 460 200">` drawing the stored path with
  `stroke-mri-sigink strokeWidth={4} fill="none" strokeLinecap="round"`, labelled
  `SERVISER · {technicianName}` and `VLASNIK · {ownerName}`. Beneath, the note bar: green
  `m.intake_signature_note_clean()` when `amendedAt === null`, amber
  `m.intake_signature_note_amended({ date, name })` otherwise.

- [ ] **Step 5: Add the widths**

Two columns at `lg:` and above; below `lg` (1024px) a single column in the order OSNOVNI PODACI →
ŠEMA/NEDOSTACI → ZATEČENO STANJE → FOTOGRAFIJE → POTPISI. The two `grid-cols-4` grids become
`grid-cols-2` at the same breakpoint.

- [ ] **Step 6: Run the test, then gate and commit**

Run: `pnpm --filter internal-web test -- tab-overview`
Expected: PASS.

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web packages/i18n
git commit -m "feat(intake): the Pregled tab, and the recorded condition finally has a reader (docs/25 V-6-1b)"
```

---

## Task 11: The Fotografije, Specifikacija and Istorija tabs

> **Corrected 2026-08-08 by a five-angle plan check, before any code.** Everything struck through
> below was verified against the tree at `c4857ed`. The originals named two symbols that do not
> exist, a test library this app does not have, and a test that passed against the bug.

**Files:**
- Create: `features/intake-orders/detail/tab-photos.tsx`, `tab-spec.tsx`, `tab-history.tsx`, `history-labels.ts`
- **Modify: `routes/_shell/prijem/$id.tsx`** — the mount point. Without it the three files are dead
  code and a clicked tab renders nothing; the strip already shows all four labels for a signed order
  (`intake-detail-tabs.tsx:29-34`). Current line to extend, `$id.tsx:95`:
  `{activeTab === IntakeDetailTab.Pregled ? <TabOverview order={order} /> : null}`. Third task in a
  row whose file list omitted this — check it every time.
- **Modify: `features/intake-orders/wizard/step-specification.tsx`** — `IntakeSpecList` has no
  `disabled` prop (props at `:40-52`), and a removed order's Spec tab is reachable: a
  `intake_orders.delete` holder can open it and `visibleIntakeDetailTab` does not look at `deletedAt`.
- **Modify: `features/intake-orders/intake-status.ts`** — history needs `DD.MM.YYYY HH:MM` with a
  **space** (prototype `:1405`, fixtures `:995`). Both existing formatters join with ` · `, so neither
  can serve; add a third rather than changing theirs (the list and the Pregled card both want the dot).
- **Modify: `packages/i18n/src/messages/{sr,en}.json`** — 11 new keys, then
  `pnpm --filter @mr/i18n run compile`.
- Test: `features/intake-orders/detail/__tests__/history-labels.test.ts`, `.../tab-spec.test.tsx`,
  `.../tab-photos.test.tsx`

**Interfaces (verified signatures, not the plan's paraphrase):**
- `IntakeSpecList` — `wizard/step-specification.tsx:54`, props `{ title, items, placeholder,
  removeLabel, onChange: (items: string[]) => void | Promise<void>, note? }`. It owns its input,
  clears the draft **only when `onChange` resolves**, guards a second Enter with `sending`, and
  removes by index. Wrapper is `IntakePanel` (radius 15) — the detail's other cards use
  `tab-overview.tsx:24`'s `CARD` (radius 14). Accepted drift; do not hand-tune.
- `IntakePhotoLightbox` — `wizard/intake-photo-lightbox.tsx:26`, props `{ cell: IntakePhotoCell,
  orderId: string | null, onClose, onDelete? }`. Takes a **cell**; resolves the full-size URL itself.
  Pass no `onDelete` (deletion is V-6-2).
- `buildPhotoCells(orderId, serverPhotos, queue, damages)` — `wizard/intake-photo-grid.tsx:51`.
  Already builds the thumbnail URL, the 1-based damage number and the marker colour, and nulls the
  number when the damage was deleted. Call it with `queue = []`, as `tab-overview.tsx:99` does. The
  cell carries **no `damageId`** — the caption's suffix condition is `cell.number !== null`.
  `IntakePhotoGrid` itself is **not** reusable here: it carries the camera/gallery inputs and the `+`
  cell, which are upload.
- `intakeOrderHistoryOptions(id)` — `packages/shared/src/queries/intake-orders.ts:122`, key
  `intakeOrderKeys.history(id)` = `['intake-orders','history',id]`, **not** under `details()`. It was
  missing from the `@mr/shared` barrel; exported in the 2026-08-08 cleanup commit, so it now imports.
- `IntakeOrderHistoryEntry` — `intake-order.wire.schema.ts:93`: `id`, **`at`** (not `createdAt`),
  `action`, `transition: string | null` (**free text, not a union**), `actorName: string | null`,
  `fromStatus`/`toStatus`: `string | null`. Newest first from the endpoint.
- `updateIntakeOrder(id, input): Promise<IntakeOrderDetail>` — returns the **full** detail, so
  `onSuccess` can write it straight into `intakeOrderKeys.detail(id)`. `{ services }` alone is a valid
  body; `{}` is rejected. Never spread the order in — on a signed order any key outside
  `{services, materials, checklist, fuelLevel, damages, equipmentNote}` is a 400.

- [ ] **Step 1: Write the failing tests**

House harness, not the ones the original named: **no MSW exists in internal-web** — stub `fetch`
(`detail/__tests__/intake-detail-header.test.tsx:16-24`), and the fixture is
`intakeOrderDetailFixture()` / `intakeDraftFixture()` with `await renderDetailUi(ui)`
(`detail/__tests__/render-detail.tsx:63-91`), which supplies the QueryClient and Router and — the
reason it exists — **parses the fixture through the wire schema**, since `tsconfig.json` excludes
`__tests__` from typecheck and a literal would rot silently.

```ts
describe('history labels', () => {
  it('names a status move with both ends', () => {
    expect(
      historyLabel({ action: 'update', transition: 'advance', fromStatus: 'primljeno', toStatus: 'u_radu' }),
    ).toBe(m.intake_history_status({ from: m.intake_status_primljeno(), to: m.intake_status_u_radu() }))
  })

  it('falls back to a neutral word rather than leaking an English key', () => {
    expect(historyLabel({ action: 'update', transition: 'something_new', fromStatus: null, toStatus: null }))
      .toBe(m.intake_history_generic())
  })

  // `sign`, `spec_updated`, `amend_after_signing` and `restore` all carry non-null from/toStatus,
  // because their audit `changes` hold whole before/after objects. A label that branched on
  // `fromStatus !== null` before the transition check would call all four a status move.
  it('does not read a signature as a status move', () => {
    expect(historyLabel({ action: 'update', transition: 'sign', fromStatus: 'primljeno', toStatus: 'primljeno' }))
      .toBe(m.intake_history_signed())
  })
})
```

⚠ **The original's tab-spec test passed against the bug.** "The typed line survives a failed PATCH"
is already `IntakeSpecList`'s own behaviour (`step-specification.tsx:75-86`) — delete `onMutate`,
`onError` and the toast and it still goes green. It only fails at all if `tab-spec` uses
**`mutate`** instead of `mutateAsync`, which is worth one assertion of its own. What has to be pinned
is the optimistic write and the rollback:

```tsx
it('shows the line before the server answers, and takes it back when refused', async () => {
  // fetch stubbed to 500
  await renderDetailUi(<TabSpec order={intakeOrderDetailFixture({ services: ['Pranje'] })} />)

  await userEvent.type(screen.getByPlaceholderText(m.intake_service_add()), 'Zamena filtera')
  await userEvent.click(within(servicesCard()).getByRole('button', { name: m.intake_spec_add() }))

  expect(screen.getByText('Zamena filtera')).toBeInTheDocument()   // optimistic
  await waitFor(() => expect(screen.queryByText('Zamena filtera')).not.toBeInTheDocument()) // rolled back
  expect(screen.getByPlaceholderText(m.intake_service_add())).toHaveValue('Zamena filtera')
})
```

⚠ `m.intake_service_placeholder()` **does not exist** — the placeholder key is `intake_service_add`
("Dodaj uslugu i pritisni Enter", `sr.json:694`), which is what the wizard already passes.
⚠ `getByRole('button', { name: m.intake_spec_add() })` finds **two** buttons — both cards use one
key. Scope with `within`.
⚠ Verify each new test by breaking the line it covers. Do not use `vi.fn().mockRejectedValue()` where
an unhandled rejection is the thing under test: a spy attaches its own `.then()` for
`mock.settledResults` and swallows it — measured on 2026-08-08.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter internal-web test -- history-labels tab-spec`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the history labels**

A lookup map, never a nested ternary:

```ts
const TRANSITION_LABELS: Record<string, () => string> = {
  sign: m.intake_history_signed,
  amend_after_signing: m.intake_history_amended,
  amend_photo_added: m.intake_history_photo_added,
  amend_photo_removed: m.intake_history_photo_removed,
  spec_updated: m.intake_history_spec_updated,
  soft_delete: m.intake_history_removed,
  restore: m.intake_history_restored,
}

export function historyLabel(entry: IntakeOrderHistoryEntry): string {
  if (entry.action === 'create') {
    return m.intake_history_created()
  }
  if (entry.transition === 'advance' || entry.transition === 'change_status') {
    return m.intake_history_status({ from: statusLabel(entry.fromStatus), to: statusLabel(entry.toStatus) })
  }
  const known = entry.transition === null ? undefined : TRANSITION_LABELS[entry.transition]
  return known === undefined ? m.intake_history_generic() : known()
}
```

The map is **complete against the server** — the service writes exactly `sign`, `advance`,
`change_status`, `amend_after_signing`, `spec_updated`, `soft_delete`, `restore`,
`amend_photo_added`, `amend_photo_removed`, plus `action='create'`; `photo_uploaded`,
`photo_removed` and transition-less updates are filtered out in SQL (`repository.ts:677-680`) and
`discard_draft` belongs to a hard-deleted row. No dead keys, nothing missing.

⚠ `statusLabel` does not exist and **cannot be a bare index**: the wire types both statuses as
`string | null` while `INTAKE_STATUS_LABELS` (`intake-status.ts:18`) is keyed by the
`IntakeOrderStatus` union, and this file **is** typechecked (`noUncheckedIndexedAccess`,
`noPropertyAccessFromIndexSignature`). Write a narrowing helper over that existing map — do not
re-map the four statuses — and when a status is null or unknown, fall back to
`m.intake_history_generic()` for the whole row: half a status line is worse than none.

- [ ] **Step 4: Write the three tabs**

Values are the prototype's, read out of `~/Downloads/handoff 3/prijem-prototip-v2.dc.html`, never by
eye. Colours only through `mri-*` utilities — a runtime `var(--mri-warn)` does not resolve in this app
(CLAUDE.md §5).

- `tab-photos.tsx` — prototype 597–613. One card (radius **14**, padding `20px 22px`, `gap 14`);
  header `FOTODOKUMENTACIJA · N` **entirely** in the red mono caption — unlike the Pregled card, which
  dims its `· N` (`:562`, `tab-overview.tsx:301`); grid `repeat(4,1fr)` **gap 14**; column `gap 7`;
  thumb `aspect-[4/3]` radius **10** with a `border-mri-border2`; damage badge **22×22** at
  `left/top 6`, mono `700 11px`; caption mono `500 10.5px text-mri-text2`, format
  `IMG_ + String(i+1).padStart(2,'0')` + ` · OŠT. {cell.number}` when `cell.number !== null`
  (`:1443`). A draft reaches this tab (`DRAFT_TABS` includes it), so it must render with
  `photos: []` — reuse `m.intake_detail_no_photos()` as the Pregled card does. No `+` cell, no
  upload, and ⚠ **no retry**: re-sending needs the wizard's queue, which is V-6-2. ⚠ **No amber bar
  here** — the `photosPending` warning ships page-level under the header
  (`intake-photos-pending-note.tsx`, mounted `$id.tsx:84-86`); building it again would print the same
  warning twice. If a `@container` is introduced, the lightbox must stay a **sibling** — containment
  makes the box the containing block for `position: fixed` (`tab-overview.tsx:181-184`).
- `tab-spec.tsx` — prototype 616–631, two `IntakeSpecList` cards, **no** `note`, wrapper `flex gap-4`
  with each card `flex-1`. Each change is one mutation over `updateIntakeOrder(id, { services })` /
  `{ materials }`:
  `onMutate` **must `await queryClient.cancelQueries` on the detail key first** — for an operator the
  actor's own SSE event invalidates `['intake-orders']` mid-typing, and an in-flight refetch landing
  after the optimistic write would clobber it — then `getQueryData` + `setQueryData`; `onSuccess`
  writes the returned detail; `onError` restores the snapshot and toasts. Copy
  `features/emotive-claims/detail/use-update-emotive-claim-findings.ts:15-46`, which is the same shape;
  do not invent a second one. `onChange` returns **`mutateAsync`** so a refusal reaches the list and
  the typed line survives. Also invalidate `intakeOrderKeys.history(id)`: the PATCH writes a
  `spec_updated` row, and ⚠ **SSE never reaches a serviser** — `resource_changed` publishes only to
  `operator/viewer/admin` channels, so for him nothing else would ever refresh it. Pass
  `disabled={order.deletedAt !== null}` (server answers 409). Cap the input at `maxLength={200}` —
  the schema's own limit, otherwise a long line 400s for no visible reason.
- `tab-history.tsx` — prototype 634–645. `useSuspenseQuery(intakeOrderHistoryOptions(id))` inside a
  **local** `<Suspense>` with a skeleton: without one the route's `pendingComponent` takes over and
  blanks the header, both bars and the tab strip on every switch to Istorija. Card radius **14**,
  padding `20px 22px`, **no gap**, header `mb-3.5`. Row `flex gap-4 py-3 border-b border-mri-border`
  on **every** row including the last; time `w-[130px] flex-none font-mono text-[12px] font-medium
  text-mri-text2`; label `flex-1 text-[14px]`; actor `text-[13px] text-mri-text2`, `'—'` when null.
  No empty state (prototype has none).

- [ ] **Step 5: Run the tests, then gate and commit**

Run: `pnpm --filter internal-web test -- history-labels tab-spec tab-photos`
Expected: PASS. Then break each new assertion's line and confirm the expected test — and only it —
goes red.

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web packages/i18n
git commit -m "feat(intake): photos, specification and history tabs — and the spec stays editable after signing (docs/25 V-6-1b)"
```

---

## Task 12: Resuming an unfinished intake, from anywhere

**Files** (corrected 2026-08-08 — `novi.tsx` already shipped, `packages/i18n` is not touched, and the
new test file is the wrong home):
- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-wizard.tsx` — the guard
  (Step 5′), the buffer precedence (Step 6′) and `forwardDisabled` + the hint order (Step 7′b)
- Modify: `apps/internal-web/src/routes/_shell/prijem/index.tsx` — `search={{ resume: draft.id }}` at
  **:157-158**, and export `UnfinishedBanner` so it can be asserted
- Test: extend `features/intake-orders/wizard/__tests__/intake-wizard-draft-offer.test.tsx` — the only
  harness that renders this wizard. Do **not** create `intake-wizard-resume.test.tsx`.
- ~~`routes/_shell/prijem/novi.tsx`~~ — shipped in `7afdf5a`.
- ~~`packages/i18n`~~ — no new key; the refusal reuses `m.intake_resume_failed()` and the shipped
  number-taken bar.

**Interfaces:**
- Consumes: `resumeServerOrder`, `adoptOrder`, `resumeBuffer` (all already in `intake-wizard.tsx`),
  `readIntakeDraft(reader)` / `isOfferable` (`intake-wizard-state.ts` — the identity rule shipped in
  `69eb7cc`), `authClient.useSession()` for the user id (the router context does not carry it), and
  the 403/404 contract from Task 2 plus `cec0e1c`.

> ⚠ **REWRITTEN 2026-08-08 by a five-angle plan check (four verifiers + one cross-cutting pass over
> their reports), before any code. 44 findings; the four angles agreed on the big ones.** Steps 1–4
> below are **struck out — they are not work.** Half of this task shipped in `7afdf5a`, its identity
> rule shipped in `69eb7cc`, its buffer invariant in `9f27044`, and its "already signed" warning in
> V-3. What is genuinely left is four small edits and one decision, all in §Steps 5′–7′.

- [ ] ~~**Step 1: Write the failing tests**~~ — **STRUCK.** Both snippets are unrunnable, and the
      plan's own ⚠ misdiagnosed why. It said the first test passes vacuously; in fact it **throws on
      its first line**: `69eb7cc` gave the reader an argument (`readIntakeDraft(reader: string)` →
      `isOfferable(draft, reader)` → `reader.length > 0`), so `readIntakeDraft()` reads
      `undefined.length`, is swallowed by the module's own `try`, and returns `null`. The writer also
      requires `savedBy` (`intake-wizard-state.ts:192`), which neither snippet passes. And the second
      snippet tests a guard that **already ships**: `isOfferable` refuses a buffer whose
      `savedBy !== reader`, so a colleague's draft is never offered — it can never go from red to
      green. New cases go into the existing `__tests__/intake-wizard-draft-offer.test.tsx`, the only
      harness that renders this wizard, with fixtures built as its own cases build them
      (`writeIntakeDraft({ orderId, step, values: bufferedValues(), savedBy: SERVISER_EMAIL })`,
      read back through `storedDraft()`).

- [ ] ~~**Step 2: Run them to verify they fail**~~ — **STRUCK** with Step 1. Its stated failure
      (“`resumeOrderId` is not a prop”) has been false since `7afdf5a`.

- [ ] ~~**Step 3: Add the search param**~~ — **ALREADY SHIPPED** in `7afdf5a`:
      `IntakeWizardSearchSchema` (`packages/shared/src/schemas/intake-order.wire.schema.ts:366-368`,
      with a load-bearing `.catch(undefined)` the plan's snippet omitted — a hand-typed `?resume=xx`
      must degrade to a normal new intake, not throw the route), the route
      (`routes/_shell/prijem/novi.tsx:12-23`), the `resumeOrderId` prop (`intake-wizard.tsx:72`) and
      the mount effect (`:232-237`).

- [ ] ~~**Step 4: Gate both mount effects on the resume**~~ — **STRUCK, and it must not be built.**
      Three independent reasons:
      1. **It would re-open the blocker `7afdf5a` closed.** Effect A is already gated *permanently*
         on the param (`intake-wizard.tsx:118-120`, with the reason at `:115-117`: the tablet's copy
         "may hold a DIFFERENT draft, and offering that would put the serviser inside another
         customer's car"). A flag that clears on failure re-runs the effect and offers exactly that.
         Two shipped tests pin it (`intake-wizard-draft-offer.test.tsx:153-170`, `:172-185`).
      2. **Effect B needs no flag.** The mount write is already refused by the buffer module's own
         `isWorthKeeping` (`intake-wizard-state.ts:223-225`) — the `9f27044` invariant.
      3. **A flag could not fix the loss anyway.** The write it would have to permit is the one that
         destroys the delta: on adoption, `orderId` and `values` both change, Effect B re-runs
         (deps `:149`) and replaces the single storage slot with the adopted order. The plan's own
         bar — prove a guard by deleting it and watching a test go red — cannot be met, because the
         state after the guard is the state the guard was protecting against.
      What is real in this area is **which copy of the values wins**, which is Step 6′.

- [ ] **Step 5′: One identity/state guard, in `resumeServerOrder` only**

`resumeServerOrder` (`intake-wizard.tsx:214-228`) adopts whatever the fetch returns, with no check
at all — and it is the ONLY way a foreign `orderId` can enter this tablet's buffer. `resumeBuffer`
needs **no** ownership clause: `isOfferable` already refuses anyone else's buffer at read time
(`intake-wizard-state.ts:233-237`, applied in `readIntakeDraft`, whose only caller passes
`userEmail`). A second copy of the rule there would be unreachable dead code, which §6 bans.

Refuse to adopt — do not navigate, do not add a message — when the fetched order is signed, is
removed, or is known not to be the caller's, and report with the **existing**
`m.intake_resume_failed()`, which is already what a serviser sees for a colleague's draft (his GET
404s on the row scope). Reachability: `SERVISER_PERMISSIONS` is `view_own`+`create`+`update`+
`advance`, so a colleague's row 404s for him; `OPERATOR_PERMISSIONS` holds `view`+`create`, the only
pairing that gets a 200 on a foreign draft and can reach `/prijem/novi`. So the identity clause
exists for the office, and its absence is what would put another customer's name and address on a
tablet — the Task 9 blocker, one route further along.

⚠ **The user id is NOT in the router context.** `SerializableAuthSession` carries only
`{ roles, permissions, name, email }` (`packages/auth/src/session-payload.ts:13-20`), and
`useInternalAuthUser` exposes only name + email. The one client source is the live session, exactly
as the shipped detail reads it: `authClient.useSession()` → `session?.user?.id`
(`routes/_shell/prijem/$id.tsx:55-57`, passed at `:78`). Two consequences the plan got backwards:

- **Fail OPEN, not closed:** `id !== undefined && order.technicianId !== id`. The id is `undefined`
  until the live session resolves, and refusing then would turn a serviser away from his OWN intake.
  (`intake-draft-bar.tsx:34` fails closed on purpose — hiding a button is harmless. Here it is not.)
- **Keep the callback referentially stable** — hold the id in a `useRef`, not in the dependency
  array. `resumeServerOrder` is a dependency of the mount effect (`:232-237`), so adding a value
  that changes on hydration re-fires the whole resume: second fetch, second toast, and a re-adopt
  that resets the step the serviser has already moved past.

- [ ] **Step 6′: Say which copy of the values wins — the buffer, for the same order**

**The hole neither the plan nor any single verifier saw:** `?resume=` is never cleared after
adoption (the only `navigate` calls are `{ to: '/prijem' }` and `{ to: '/prijem/$id' }`), so every
later reload of that address re-fetches, re-adopts the SERVER copy, and Effect B then writes it over
the tablet's newer buffer. A whole step's typing lives only in that buffer — step patches fire only
in `goForward` (`:240-261`), so step 4's services and materials are nowhere else. Step 7′ makes this
the shop's most prominent button, so it must be answered here, not drifted into.

Inside `resumeServerOrder`, after the fetch passes Step 5′'s checks: read `readIntakeDraft(userEmail)`
and when `draft.orderId === order.id`, adopt the **buffer's** values with
`Math.max(draft.step, order.draftStep ?? 1)`; otherwise adopt the server's, as today. The buffer for
the same order is by construction at or ahead of the last patch, and the reader has already refused
anything older than a shift or belonging to someone else.

Stripping the param instead was considered and rejected: it cannot fix the **first** reload, because
by the time the param is stripped the adoption has already overwritten the delta.

⚠ **Stated loss, on the record:** if the same order was moved forward on ANOTHER tablet within the
same shift, this tablet's buffer now wins. That is the upward flush the buffer spec leaves open
(§7.6) and is deliberately out of scope. Say it in the commit message.

- [ ] **Step 7′: The list banner, and the dead end past step 1**

**(a)** `routes/_shell/prijem/index.tsx:157-158` — add `search={{ resume: draft.id }}` to the
`<Link to="/prijem/novi">`. (The plan's `:165` is a closing brace; `:85-86` is the header CTA, a
different button that must keep opening an empty intake.) `UnfinishedBanner` is module-local, so
export it to make the assertion possible; the assertion itself already exists for its twin —
`detail/__tests__/intake-draft-bar.test.tsx:19-23` asserts the href, and `renderDetailUi` registers
`/prijem/novi` without `validateSearch`, which is why `search` serialises into it.

**(b)** A stale resume (adopted, then the order was signed elsewhere) shows the shipped red bar but
still has `DALJE` enabled, and dead-ends on a 422. `intake-wizard.tsx:285-286` becomes
`saving || numberTaken || (step === 1 && !canLeaveStep1)`, and the `numberTaken` hint branch
(`:388-390`) is hoisted above the `if (step !== 1)` early return (`:382-384`) so the disabled button
says why.

This is the whole of what Step 5's `adoptIfMine` was for, and it needs **no new message key**: the
red bar and its `Otvori nalog →` link already ship (`intake-wizard-note.tsx:111-139`), are driven by
the ORDER NUMBER — which every adoption fills — and therefore cover all three entrances (`?resume=`,
the note's own resume, the buffer) without knowing which one ran. They also cannot false-positive on
the wizard's own draft (`TakenDraftMine` excludes `data.orderId === currentOrderId`, `:90-94`). A
link the serviser can read and decide on beats a forced redirect. So `intake_resume_already_signed`
and `intake_resume_not_yours` are **never added**, and `packages/i18n` drops out of this task.

⚠ Known and NOT in scope: a soft-deleted order reads as `Free` from `checkNumber`
(`findByNumberKey` filters `isNull(deleted_at)`), so the bar cannot announce that one state — every
mutation on it 409s or 404s. And `finish` is not gated by `forwardDisabled`, so a stale buffer at
step 5 can still press ZAVRŠI and take a 409. Both pre-existing; report, do not fix here.

- [ ] **Step 8′: Test ripple, then gate and commit**

⚠ `intake-wizard-draft-offer.test.tsx:108-129` and `:131-151` click resume on a buffer with
`orderId: 'order-1'` while `beforeEach` stubs **every** request as `new Response('{}')`, which
`IntakeOrderDetailSchema` rejects. **Two green tests here are not evidence the reconcile works —
they are evidence it did not fire.** Whatever shape Step 6′ takes, one new case must prove the
buffer's values survive a `?resume=` reload, and one must prove a foreign order is not adopted.

Run: `pnpm --filter internal-web test -- intake-wizard`. Then break each new assertion's line and
confirm the expected test — and only it — goes red.

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web
git commit -m "feat(intake): an unfinished intake resumes from the list, and the tablet's own copy wins (docs/25 V-6-1b)"
```

**Acceptance walk, split by actor** (the plan's original walk, and design-spec §8's, cannot be
performed: for a serviser a colleague's id 404s, so there is no detail to be "turned away" to):

- serviser + a colleague's id → `Nalog nije moguće učitati.`, he stays on an empty new intake.
- **operator** (`view` + `create`) + a colleague's draft → refused by the identity clause; this is
  the only actor that reaches it.
- **the walk that would have caught the real regression:** from the list banner, resume, advance to
  step 4, type a service line, do NOT press DALJE, reload the tab (the address still carries
  `?resume=`) — the line must still be there.

---

## Task 13: Measure it, then hand it over

No new behaviour. This is the pass that catches what tests cannot.

**Files:** none, unless a measurement finds something.

- [ ] **Step 1: Full gate, forced**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
```

- [ ] **Step 2: Compile the messages**

```bash
pnpm --filter @mr/i18n run compile
```

Then confirm sr/en parity: both files must have identical key sets (CI enforces it, but catching it
here is cheaper).

- [ ] **Step 3: Walk it as an operator**

On the owner's running `pnpm dev:all` — **never start or restart it yourself**. Open a signed order
and: walk all four tabs · add and remove a service line and see it survive a reload · correct the
status and watch the row appear in Istorija · remove the order, find it under `Prikaz: Uklonjeni`,
open it (no action buttons, no editable inputs) and restore it.

- [ ] **Step 4: Walk it as a serviser**

Own order: advance works, no status bar, no remove, the spec tab is editable. A colleague's id typed
straight into the address bar: the not-found screen, not a 403 page. `/prijem/novi?resume=<a
colleague's draft>`: turned away with a toast, landing on the detail.

- [ ] **Step 5: Walk the draft**

Open an unfinished intake from both accounts: `NASTAVI PRIJEM` only for its owner, and continuing
lands on the step the server recorded — not one step back. Confirm the list banner's button behaves
identically to the detail's.

- [ ] **Step 6: Measure the widths**

At **1180×820**, **820** and **430**, chosen from DevTools' Dimensions menu by the owner — never
resize his window. From the page, measure `document.documentElement.scrollWidth` against
`clientWidth` (they must be equal), and audit each grid cell's right edge against its column's.
Report the numbers, not an impression.

- [ ] **Step 7: Report**

Summarise: the gate result, what was walked, what was measured, and every place the built screen
differs from `Uputstvo Prijem Vozila` (docs/25 §9.2 requires each one to be reported). Do not push
until the owner has the report.

---

## Self-Review

**Spec coverage** — every section maps to a task: §4.1 → T9 · §4.2 → T9 · §4.3 → T6+T9 · §4.4 → T8+T10 · §4.5 → T11 · §4.6 → T7+T11 · §4.7 → T1+T11 · §4.8 → T9+T12 · §4.9 → T4+T9 · §4.10 → T9 · §4.11 → T5 · §4.12 → T10+T13 · §5 → T9 · §6.1 → T1 · §6.2 → T2 · §6.3 → T3 · §6.4 → T4 · §6.5 → T5 · §8 → T13 · §9.4 (the stale CLAUDE.md §5 paragraph) → **fold into Task 1's commit**, it is a one-paragraph doc correction.

**Type consistency** — `IntakeOrderListView` is defined in T5 and consumed in T5 and T9 · `deletedAt` is defined in T4 and consumed in T9, T10, T11 · `IntakeSpecList` / `IntakePhotoLightbox` are defined in T7 and consumed in T10 and T11 · `variant` is defined in T8 and consumed in T10 · `INTAKE_CHECKLIST_LABELS` is defined in T6 and consumed in T10 · `'spec_updated'` is written in T1 and read in T11 · `restoreIntakeOrder` is defined in T4 and called in T9.

**Known softness, deliberately left to the implementer** — three names are described rather than quoted because they must be read from the code at implementation time and inventing them would be worse than saying so: the intake module's order-number key normaliser (used in T4's clash check), the `internalRequireIntakeOrdersView` guard's exact export name (T9), and the existing `photoInput()` test helper (T2, T3). Each step says to read the neighbouring code first.
