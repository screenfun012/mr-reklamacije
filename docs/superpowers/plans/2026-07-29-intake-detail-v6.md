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

**Files:**
- Create: `features/intake-orders/detail/tab-photos.tsx`, `tab-spec.tsx`, `tab-history.tsx`, `history-labels.ts`
- Test: `features/intake-orders/detail/__tests__/history-labels.test.ts`, `.../tab-spec.test.tsx`

**Interfaces:**
- Consumes: `IntakeSpecList` (Task 7), `IntakePhotoLightbox` (Task 7), `intakeOrderHistoryOptions` + `updateIntakeOrder` (`@mr/shared`), the `spec_updated` transition (Task 1).

- [ ] **Step 1: Write the failing tests**

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
})
```

```tsx
it('puts the typed line back when the save fails', async () => {
  server.use(failingPatch())
  const { getByPlaceholderText, getByRole } = render(<TabSpec order={signedOrderFixture} />)

  const input = getByPlaceholderText(m.intake_service_placeholder())
  await user.type(input, 'Zamena filtera')
  await user.click(getByRole('button', { name: m.intake_spec_add() }))

  await waitFor(() => expect(input).toHaveValue('Zamena filtera'))
})
```

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

There is deliberately **no** `discard_draft` entry: that order is hard-deleted, so its history is
unreachable (spec §4.7).

- [ ] **Step 4: Write the three tabs**

- `tab-photos.tsx` — prototype 597–613. One card `FOTODOKUMENTACIJA · N`, `grid-cols-4 gap-3.5`,
  `aspect-[4/3]` cells, the damage badge, caption `IMG_03 · OŠT. 2` (position padded to two digits,
  the damage suffix only when `damageId` matches). An amber bar above the grid when
  `photosPending > 0`.
- `tab-spec.tsx` — prototype 616–631, two `IntakeSpecList` cards with **no** `note`. Each change
  calls `updateIntakeOrder(id, { services })` / `{ materials }` through a mutation with `onMutate`
  writing the new array into the detail query, and `onError` restoring the previous cache value,
  toasting, and handing the typed text back to the input. Inputs are disabled when
  `deletedAt !== null`.
- `tab-history.tsx` — prototype 634–645. `useSuspenseQuery(intakeOrderHistoryOptions(id))` inside a
  Suspense boundary with a skeleton. Rows: time `w-[130px] font-mono text-mri-text2`, the label,
  then `actorName ?? '—'`.

- [ ] **Step 5: Run the tests, then gate and commit**

Run: `pnpm --filter internal-web test -- history-labels tab-spec tab-photos`
Expected: PASS.

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web packages/i18n
git commit -m "feat(intake): photos, specification and history tabs — and the spec stays editable after signing (docs/25 V-6-1b)"
```

---

## Task 12: Resuming an unfinished intake, from anywhere

**Files:**
- Modify: `apps/internal-web/src/routes/_shell/prijem/novi.tsx` (the `?resume=` search param)
- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-wizard.tsx`
- Modify: `apps/internal-web/src/routes/_shell/prijem/index.tsx` (the banner link at :165)
- Test: `features/intake-orders/wizard/__tests__/intake-wizard-resume.test.tsx`

**Interfaces:**
- Consumes: `resumeServerOrder`, `adoptOrder`, `resumeBuffer` (all already in `intake-wizard.tsx`), the 403 contract from Task 2.

- [ ] **Step 1: Write the failing tests**

```tsx
it('does not overwrite another intake\'s buffer while a resume is in flight', async () => {
  writeIntakeDraft({ orderId: 'other-order', step: 3, values: filledValues })
  render(<IntakeWizard resumeOrderId="target-order" />)

  // The buffer must still hold the other intake until the fetch resolves and adopts.
  expect(readIntakeDraft()?.orderId).toBe('other-order')
  await waitFor(() => expect(readIntakeDraft()?.orderId).toBe('target-order'))
})

it('refuses to hand a colleague\'s buffered draft to whoever is signed in', async () => {
  writeIntakeDraft({ orderId: 'colleague-order', step: 2, values: filledValues })
  render(<IntakeWizard />)

  await user.click(await screen.findByRole('button', { name: m.intake_draft_resume() }))

  await waitFor(() => expect(readIntakeDraft()).toBeNull())
  expect(screen.queryByDisplayValue(filledValues.orderNumber)).toBeNull()
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter internal-web test -- intake-wizard-resume`
Expected: FAIL — `resumeOrderId` is not a prop.

- [ ] **Step 3: Add the search param**

```tsx
export const Route = createFileRoute('/_shell/prijem/novi')({
  beforeLoad: internalRequireIntakeOrdersCreate(),
  validateSearch: (search) => IntakeWizardSearchSchema.parse(search),
  component: IntakeWizardRoute,
})
```

with `IntakeWizardSearchSchema = z.object({ resume: z.string().uuid().optional() })` beside the
detail search schema in `@mr/shared`, and `IntakeWizardRoute` reading it and passing
`resumeOrderId`.

- [ ] **Step 4: Gate both mount effects on the resume**

In `intake-wizard.tsx`, derive a flag before the two existing effects and read it inside them:

```tsx
// The buffer effect writes localStorage from wizard state on mount. With a resume in flight
// that would overwrite ANOTHER intake's buffer with empty values before the fetch resolves —
// and with the offer suppressed there is no in-memory copy left to restore from. So both
// effects wait until the resume has adopted or failed.
const [resuming, setResuming] = useState(resumeOrderId !== undefined)
```

Effect A (the buffer offer): `if (resuming) return` before `setFoundDraft`.
Effect B (the buffer write): `if (resuming) return` before `writeIntakeDraft`.
A mount effect calls `resumeServerOrder(resumeOrderId)`; both its success and failure paths clear
`resuming`.

- [ ] **Step 5: Guard both resume paths**

Extend `resumeServerOrder` and add the same two checks to `resumeBuffer`:

```tsx
const adoptIfMine = useCallback(
  (order: IntakeOrderDetail): boolean => {
    if (order.signedAt !== null) {
      showInternalToast(m.intake_resume_already_signed())
      void navigate({ to: '/prijem/$id', params: { id: order.id } })
      return false
    }
    if (order.technicianId !== currentUserId) {
      showInternalToast(m.intake_resume_not_yours())
      void navigate({ to: '/prijem/$id', params: { id: order.id } })
      return false
    }
    adoptOrder(order)
    return true
  },
  [adoptOrder, currentUserId, navigate],
)
```

`resumeBuffer` now fetches the order by `foundDraft.orderId` and runs it through `adoptIfMine`;
when that returns false it calls `clearIntakeDraft()` so a shared tablet does not keep offering a
draft nobody signed in can move. Shop tablets are shared, and after Task 2 an unguarded adoption
means every subsequent action 403s with a generic save error and no way out.

`currentUserId` comes from the session the shell already provides — read how the topbar gets the
signed-in user rather than adding a new query.

- [ ] **Step 6: Point the list banner at the same param**

In `index.tsx:165`, add `search={{ resume: draft.id }}` to the existing `to="/prijem/novi"` link.
Without it the app ships two `NASTAVI PRIJEM` buttons with different behaviour, the more prominent
one working only on the tablet holding the buffer.

- [ ] **Step 7: Run the tests, then gate and commit**

Run: `pnpm --filter internal-web test -- intake-wizard`
Expected: PASS, existing wizard tests included.

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web packages/shared packages/i18n
git commit -m "feat(intake): an unfinished intake resumes from the detail, the list and another tablet (docs/25 V-6-1b)"
```

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
