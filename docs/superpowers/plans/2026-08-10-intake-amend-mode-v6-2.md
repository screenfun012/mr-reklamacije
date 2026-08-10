# V-6-2 Intake Amend Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the office a way to correct a signed intake order — the recorded condition (checklist, fuel, damage markers, equipment note), the owner's phone, and the photo set — where every correction stamps the document permanently and says truthfully, on all four surfaces, what was corrected.

**Architecture:** Four passes. **Server first (Tasks 1–2):** the phone joins the amendable bucket with a transition of its own, the service drops patch keys whose value already equals the stored one (a permanent stamp must never come from a no-op), and the two sentences that today claim "the recorded condition changed" are rewritten neutrally because one unnamed stamp column feeds four surfaces. **The page next (Task 3):** edit mode and its buffer live in `IntakeDetailPage`, above the tab strip, because the header and the tab body are siblings and switching tabs unmounts the body; entry navigates to `?tab=pregled` and locks the tab strip and every header action. **The cards (Tasks 4–5):** the existing Pregled cards become editable in place — no new card is introduced, because the checklist card already exists and a second one would render it twice. **Photos (Task 6):** outside edit mode, in the Fotografije tab, every action immediate, with the upload queue owned by the page so a failed office upload survives a tab switch. **Task 7** measures and hands over.

**Tech Stack:** Hono + Drizzle + PostgreSQL (api) · TanStack Start/Router + React 19 + TanStack Query (internal-web) · Zod (`@mr/shared`) · Paraglide (`@mr/i18n`) · Vitest (component + integration) · Tailwind v4 with `mri-*` tokens.

**Source of truth:** `docs/superpowers/specs/2026-08-09-intake-amend-mode-v6-2-design.md` — approved 2026-08-10, decisions ①–⑧ in its §1. Visual values in its §3.4 were transferred from `prijem-prototip-v2.dc.html` and are reproduced verbatim in the tasks below; do not re-derive them by eye.

## Global Constraints

- **No migration. No new permission. No prod seed.** Every column and every permission this plan needs already exists (`intake_orders.amend` is seeded and held by operator + admin). If a task appears to need DDL or a new permission, stop and report it — that is a finding, not a step.
- **The stamp is one unnamed pair of columns** (`amended_at` / `amended_by`, `intake-orders.repository.ts:471-474`) read by **four** surfaces: the header badge, the note beside the signatures, the list marker and the history row. Only the history row knows the transition. Therefore **no surface except the history may name what was changed** (spec §2.2, decision ⑥).
- **404, never 403, for row-level scope.** A serviser must not learn a colleague's order exists. 403 stays correct where the caller legitimately knows the row exists.
- **Colours only through `mri-*` utility classes.** Never `var(--mri-warn)` and friends — the status hues exist only inside `@theme inline`, and an unresolved `var()` silently drops the property to its initial value (CLAUDE.md §5).
- **No ICU plurals.** Paraglide in this repo rejects them. Phrase counts so no grammatical form depends on the number.
- **sr + en key parity is CI-enforced.** Every new key lands in both `packages/i18n/src/messages/sr.json` and `en.json`. After editing them run `pnpm --filter @mr/i18n run compile`, or dev keeps showing the old text.
- **Serbian is informal ("ti"), follows the glossary.** "Nalog", "Prilog", "Zatečeno stanje" — do not invent synonyms.
- **Style:** no semicolons, single quotes, 2-space indent, trailing commas. `kebab-case` files, `PascalCase` components, one primary export per file. No `any`, no non-null `!`, no `enum`, no nested ternaries (lookup map or helper), functions under 30 lines, files under 500 lines. Explicit return types on exported functions and service/repository methods. Comment **why**, never what.
- **Layer law:** the controller never touches the DB; the service and repository never import `hono`. Audit in the service layer.
- **Never start or kill the dev servers.** `pnpm dev:all` is Nikola's terminal. Verification uses one-off commands that exit.
- **Full gate before every commit** (add `--concurrency=4` — the dev servers are running):
  `pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration`
- **Run every command from the checkout root** (`/Users/nikola/Developer`), not from a sibling worktree.
- **Push when the work is genuinely finished** — full gate green, no holes. Feature branches do not deploy (Railway watches `main`), so a push protects the work. If anything is missing, do not push and say why.

---

## File Structure

**Shared (`packages/shared/src/`)**

- `utils/intake-condition-equal.ts` — **new.** `sameIntakeChecklist` and `sameIntakeDamages`. Both the API (deciding whether a patch is a no-op) and internal-web (building the diff) need the identical answer; two copies would drift and each drift silently either drops a real correction or stamps a document nobody edited.
- `utils/__tests__/intake-condition-equal.test.ts` — **new.**

**API (`apps/api/src/modules/intake-orders/`)**

- `intake-orders.service.ts` — **modify.** `CONTACT_FIELDS`, `classifyPostSigningPatch` (replaces the boolean `assertPostSigningPatchAllowed`), `withoutUnchanged`, third value in `updateTransition`, no-op short-circuit in `update`.
- `__tests__/intake-orders.integration.test.ts` — **modify.** Six new cases.

**i18n (`packages/i18n/src/messages/`)**

- `sr.json` + `en.json` — **modify.** Two rewritten strings, one new history key (Task 2), and the amend-mode / photo-action copy (Tasks 3–6).

**internal-web (`apps/internal-web/src/`)**

- `features/intake-orders/detail/history-labels.ts` — **modify.** Map the new transition.
- `features/intake-orders/detail/use-intake-amend.ts` — **new.** The buffer, the diff, the phone rule, the save mutation. The one place that decides what leaves the screen.
- `features/intake-orders/detail/intake-amend-bar.tsx` — **new.** The amber "REŽIM IZMENE" strip with OTKAŽI / ✓ SAČUVAJ IZMENU.
- `routes/_shell/prijem/$id.tsx` — **modify.** Owns edit mode, the buffer and the photo queue; wires the header, the bar, the tabs and the two tab bodies.
- `features/intake-orders/detail/intake-detail-header.tsx` — **modify.** The "Ispravi zatečeno stanje" button; advance / remove disabled while the mode is open.
- `features/intake-orders/detail/intake-detail-tabs.tsx` — **modify.** `locked` renders the strip as inert text instead of links.
- `features/intake-orders/detail/tab-overview.tsx` — **modify.** Accepts optional edit props, delegates two cards to their own files, gains the phone field and the fuel stepper.
- `features/intake-orders/detail/card-condition.tsx` — **new.** "Zatečeno stanje" — read view and edit view of the same card. Extracted because `tab-overview.tsx` is already 368 lines and the house limit is 500.
- `features/intake-orders/detail/card-damages.tsx` — **new.** "Šema" + "Nedostaci" — same reason.
- `features/intake-orders/detail/tab-photos.tsx` — **modify.** `+` cell, upload state on cells, delete through the lightbox, both confirmed.
- `features/intake-orders/wizard/intake-photo-picker.tsx` — **new.** The camera/gallery file inputs, extracted from `intake-photo-grid.tsx` so both the wizard and the detail open the same picker.
- `features/intake-orders/wizard/intake-photo-cell-state.tsx` — **new.** The uploading / waiting / failed veil, extracted for the same reason.
- `features/intake-orders/wizard/intake-photo-grid.tsx` — **modify.** Uses the two extracted pieces; behaviour unchanged.
- `features/intake-orders/wizard/use-intake-photo-queue.ts` — **modify.** Optional `onFailure` callback (the wizard passes none and keeps its chip; the detail raises a toast).
- `features/intake-orders/wizard/intake-wizard-state.ts` — **modify.** Export `optionalText` (one line) so the diff builder does not write a second copy.
- Tests: `detail/__tests__/use-intake-amend.test.ts` (**new**), and extensions to `detail/__tests__/{intake-detail-header,intake-detail-tabs,tab-overview,tab-photos,history-labels}.test.*`.

**Docs**

- `docs/25-vehicle-intake.md` — **modify** (Task 2 and Task 7): the amendable-field list gains `ownerPhone` and the equipment note, and §3.5's print marker is described neutrally so V-7 does not start from a false sentence.

---

## Task 1: The server takes a phone correction, and refuses to stamp a no-op

**Files:**

- Create: `packages/shared/src/utils/intake-condition-equal.ts`
- Create: `packages/shared/src/utils/__tests__/intake-condition-equal.test.ts`
- Modify: `packages/shared/src/index.ts` (export the two helpers — follow the file's existing export style)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts:64-90` (field buckets, transition), `:317-357` (`update`), `:387-420` (the guard)
- Test: `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`

**Interfaces:**

- Produces: `sameIntakeChecklist(a: IntakeChecklist, b: IntakeChecklist): boolean` · `sameIntakeDamages(a: readonly IntakeDamage[], b: readonly IntakeDamage[]): boolean` — Task 3 imports both from `@mr/shared`.
- Produces: the transition string `'amend_contact_after_signing'` — Task 2 maps it to a label.
- Consumes: nothing from later tasks.

- [ ] **Step 1: Write the failing test for the equality helpers**

Create `packages/shared/src/utils/__tests__/intake-condition-equal.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { IntakeDamageType } from '../../schemas/intake-order.schema.js'
import { sameIntakeChecklist, sameIntakeDamages } from '../intake-condition-equal.js'

const CHECKLIST = {
  rezervna: true,
  dizalica: true,
  komplet: null,
  saobracajna: true,
  vozacka: null,
  prvaPomoc: false,
  prsluk: true,
  lanci: false,
}

const DAMAGE = { id: 'd1', type: IntakeDamageType.Scratch, x: 100, y: 60, zone: 'Prednja leva' }

describe('sameIntakeChecklist', () => {
  it('separates an untouched row from a "no"', () => {
    expect(sameIntakeChecklist(CHECKLIST, { ...CHECKLIST })).toBe(true)
    expect(sameIntakeChecklist(CHECKLIST, { ...CHECKLIST, komplet: false })).toBe(false)
  })
})

describe('sameIntakeDamages', () => {
  it('sees a moved, retyped, added or removed marker', () => {
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE }])).toBe(true)
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE, x: 101 }])).toBe(false)
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE, type: IntakeDamageType.Dent }])).toBe(false)
    expect(sameIntakeDamages([DAMAGE], [])).toBe(false)
    expect(sameIntakeDamages([], [DAMAGE])).toBe(false)
  })

  it('ignores the zone, which the server derives from type and position', () => {
    expect(sameIntakeDamages([DAMAGE], [{ ...DAMAGE, zone: 'Zadnja desna' }])).toBe(true)
  })
})
```

⚠️ Check the real names first: `IntakeDamageType` members and the checklist keys are in `packages/shared/src/schemas/intake-order.schema.ts`. Use what is there, not what is typed above, if they differ.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @mr/shared test -- intake-condition-equal`
Expected: FAIL — cannot resolve `../intake-condition-equal.js`.

- [ ] **Step 3: Write the helpers**

Create `packages/shared/src/utils/intake-condition-equal.ts`:

```ts
import { INTAKE_CHECKLIST_KEYS, type IntakeChecklist, type IntakeDamage } from '../schemas/intake-order.schema.js'

/**
 * Whether two recorded conditions say the same thing. Shared between the API — which refuses to
 * stamp a signed document when a patch changes nothing — and the detail screen, which builds the
 * patch. Two copies would drift, and either direction of drift is silent: one drops a real
 * correction, the other stamps a document nobody edited.
 */
export function sameIntakeChecklist(a: IntakeChecklist, b: IntakeChecklist): boolean {
  return INTAKE_CHECKLIST_KEYS.every((key) => a[key] === b[key])
}

/**
 * Position and identity, in order — the array order IS the ①②③ numbering. The `zone` is left out
 * on purpose: the server derives it from (vehicleType, x, y), so comparing it would report a
 * change whenever a client sent a stale word for an unmoved marker.
 */
export function sameIntakeDamages(
  a: readonly IntakeDamage[],
  b: readonly IntakeDamage[],
): boolean {
  if (a.length !== b.length) {
    return false
  }
  return a.every((damage, index) => {
    const other = b[index]
    return (
      other !== undefined &&
      damage.id === other.id &&
      damage.type === other.type &&
      damage.x === other.x &&
      damage.y === other.y
    )
  })
}
```

Export both from `packages/shared/src/index.ts`, in the same one-line style as its neighbours:

```ts
export { sameIntakeChecklist, sameIntakeDamages } from './utils/intake-condition-equal.js'
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @mr/shared test -- intake-condition-equal`
Expected: PASS (2 files, 3 tests).

- [ ] **Step 5: Write the failing integration tests**

In `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`, inside `describe('the freeze after signing', …)` (around `:344`), add. Reuse the file's existing `officeActor` / `floorActor` / `signedOrder` helpers — read them at `:76-140` first and match their real signatures:

```ts
it('lets the office correct the owner phone, and stamps it as a contact amendment', async () => {
  const serviser = await floorActor()
  const office = await officeActor('Ana')
  const order = await signedOrder(serviser)

  const updated = await service.update(
    order.id,
    { ownerPhone: '+381 64 111 2233' },
    office,
    auditContext(office),
  )

  expect(updated.ownerPhone).toBe('+381 64 111 2233')
  expect(updated.amendedAt).not.toBeNull()
  expect(updated.amendedByName).toBe('Ana')

  const transitions = await transitionsOf(order.id)
  expect(transitions).toContain('amend_contact_after_signing')
  expect(transitions).not.toContain('amend_after_signing')
})

it('refuses a phone correction from a serviser, who holds no amend', async () => {
  const serviser = await floorActor()
  const order = await signedOrder(serviser)

  await expect(
    service.update(order.id, { ownerPhone: '+381 64 111 2233' }, serviser, auditContext(serviser)),
  ).rejects.toBeInstanceOf(ForbiddenError)
})

it('still refuses the owner name, which is on the paper the customer holds', async () => {
  const serviser = await floorActor()
  const office = await officeActor('Ana')
  const order = await signedOrder(serviser)

  await expect(
    service.update(order.id, { ownerName: 'Neko Drugi' }, office, auditContext(office)),
  ).rejects.toBeInstanceOf(ValidationError)
})

it('writes one history row when a request touches both the condition and the phone', async () => {
  const serviser = await floorActor()
  const office = await officeActor('Ana')
  const order = await signedOrder(serviser)

  await service.update(
    order.id,
    { fuelLevel: order.fuelLevel === 6 ? 5 : 6, ownerPhone: '+381 64 111 2233' },
    office,
    auditContext(office),
  )

  // The condition wins: the vehicle's recorded state changed, which is the louder fact, and one
  // request must not produce two rows that a reader has to reconcile.
  const transitions = await transitionsOf(order.id)
  expect(transitions.filter((value) => value?.startsWith('amend')).length).toBe(1)
  expect(transitions).toContain('amend_after_signing')
})

it('does not stamp a signed order when every value in the patch is what it already holds', async () => {
  const serviser = await floorActor()
  const office = await officeActor('Ana')
  const order = await signedOrder(serviser)

  const updated = await service.update(
    order.id,
    {
      ownerPhone: order.ownerPhone,
      fuelLevel: order.fuelLevel,
      checklist: order.checklist,
      damages: order.damages,
    },
    office,
    auditContext(office),
  )

  // The stamp is permanent and it prints. A double tap, a re-submitted form or a second caller
  // must not be able to mark a document nobody edited.
  expect(updated.amendedAt).toBeNull()
  const transitions = await transitionsOf(order.id)
  expect(transitions.filter((value) => value?.startsWith('amend')).length).toBe(0)
})

it('leaves a draft patchable with its whole state, unchanged values included', async () => {
  const serviser = await floorActor()
  const draft = await service.create(draftInput(), serviser, auditContext(serviser))

  const updated = await service.update(
    draft.id,
    { ownerPhone: draft.ownerPhone, fuelLevel: draft.fuelLevel, draftStep: 3 },
    serviser,
    auditContext(serviser),
  )

  // The wizard sends the whole form on every step; pruning is a signed-order rule only.
  expect(updated.draftStep).toBe(3)
  expect(updated.amendedAt).toBeNull()
})
```

⚠️ `transitionsOf`, `auditContext` and `draftInput` are shorthand for whatever the file already uses (the existing test at `:1169` reads transitions out of the audit log — copy that exact code rather than inventing a helper). If a helper genuinely does not exist, write the smallest local one inside the `describe`.

- [ ] **Step 6: Run them and watch them fail**

Run: `pnpm --filter api test:integration -- intake-orders`
Expected: FAIL — the phone case throws `ValidationError: ... ownerPhone cannot be changed after signing`; the no-op case reports a stamp.

⚠️ If an EXISTING test in this file also turns red, read it before touching it: a case that patched a signed order with a value equal to the stored one and expected a stamp is now asserting the old behaviour and its expectation moves. A case that fails for any other reason is a finding — stop and report.

- [ ] **Step 7: Implement the server change**

In `apps/api/src/modules/intake-orders/intake-orders.service.ts`:

```ts
/** The intake condition — correcting it after signing requires `intake_orders.amend`. */
const CONDITION_FIELDS = ['checklist', 'fuelLevel', 'damages', 'equipmentNote'] as const

/**
 * Also an amendment — it stamps the document — but not of the vehicle's condition. Nikola,
 * 2026-08-08: a wrong phone number is the one frozen field that makes the record useless for its
 * own purpose, since it is how the shop reaches the owner about the car it is holding.
 */
const CONTACT_FIELDS = ['ownerPhone'] as const

type IntakeAmendmentKind = 'condition' | 'contact'
```

```ts
/**
 * A patch of a SIGNED order is an amendment of the condition, an amendment of the contact, or an
 * edit of the two fields that stay free. The free edit still has to reach the Istorija tab, so it
 * is tagged rather than left transition-less, which is the shape the history projection drops.
 */
function updateTransition(
  signedAt: string | null,
  amendment: IntakeAmendmentKind | null,
): 'amend_after_signing' | 'amend_contact_after_signing' | 'spec_updated' | null {
  if (amendment === 'condition') {
    return 'amend_after_signing'
  }
  if (amendment === 'contact') {
    return 'amend_contact_after_signing'
  }
  if (signedAt !== null) {
    return 'spec_updated'
  }
  return null
}
```

Replace `assertPostSigningPatchAllowed` (`:392-420`) with:

```ts
/**
 * Which kind of amendment this patch is, or null when it only touches the free fields. Throws
 * when it touches anything the signed document must keep, and when the caller may not amend.
 */
private classifyPostSigningPatch(
  patch: IntakeOrderUpdateInput,
  actor: IntakeOrdersActor,
): IntakeAmendmentKind | null {
  const touched = Object.keys(patch)
  const free = new Set<string>(FREE_AFTER_SIGNING)
  const condition = new Set<string>(CONDITION_FIELDS)
  const contact = new Set<string>(CONTACT_FIELDS)

  const conditionTouched = touched.filter((field) => condition.has(field))
  const contactTouched = touched.filter((field) => contact.has(field))
  const frozenTouched = touched.filter(
    (field) => !free.has(field) && !condition.has(field) && !contact.has(field),
  )

  if (frozenTouched.length > 0) {
    throw new ValidationError(
      `Signed intake order: ${frozenTouched.join(', ')} cannot be changed after signing`,
    )
  }

  if (conditionTouched.length === 0 && contactTouched.length === 0) {
    return null
  }

  // The freeze is enforced here, not only on the route: a serviser holds `update` and must not
  // be able to route around the office's amend gate by patching the condition.
  if (!actor.permissions.includes('intake_orders.amend')) {
    throw new ForbiddenError('Amending a signed intake order requires amend')
  }

  // The condition wins when one request carries both — one request, one row in the history.
  return conditionTouched.length > 0 ? 'condition' : 'contact'
}
```

Add, next to `withDerivedZones`:

```ts
/**
 * Drops every stamping key whose value already equals what the order holds. The stamp is
 * permanent and it prints, so it must come from a real correction and nothing else — the screen
 * guards this too, but the guard belongs where every caller passes. Signed orders only: the
 * wizard patches a draft with its whole form on every step and expects all of it to land.
 */
private withoutUnchanged(
  patch: IntakeOrderUpdateInput,
  before: IntakeOrderDetail,
): IntakeOrderUpdateInput {
  const kept = { ...patch }

  if (kept.ownerPhone === before.ownerPhone) delete kept.ownerPhone
  if (kept.fuelLevel === before.fuelLevel) delete kept.fuelLevel
  if (kept.equipmentNote === before.equipmentNote) delete kept.equipmentNote
  if (kept.checklist !== undefined && sameIntakeChecklist(kept.checklist, before.checklist)) {
    delete kept.checklist
  }
  if (kept.damages !== undefined && sameIntakeDamages(kept.damages, before.damages)) {
    delete kept.damages
  }

  return kept
}
```

And rewrite the middle of `update` (`:331-342`):

```ts
const derived = this.withDerivedZones(patch, before)
const effective =
  before.signedAt === null ? derived : this.withoutUnchanged(derived, before)

if (Object.keys(effective).length === 0) {
  // Nothing to write: no stamp, no history row, no realtime signal.
  return before
}

const amendment =
  before.signedAt === null ? null : this.classifyPostSigningPatch(effective, actor)

const updated = await this.repo.update(
  id,
  effective,
  amendment !== null ? auditContext.actorUserId : null,
)
if (updated === null) {
  throw new NotFoundError('Intake order', id)
}

const transition = updateTransition(before.signedAt, amendment)
```

⚠️ `withDerivedZones` moves OUT of the `repo.update(...)` argument list — it now runs before pruning, so an unmoved marker is compared against a server-derived zone rather than whatever the client sent. Delete the old inline call; leaving both would derive twice.

Import `sameIntakeChecklist` and `sameIntakeDamages` from `@mr/shared`.

- [ ] **Step 8: Run the integration tests and watch them pass**

Run: `pnpm --filter api test:integration -- intake-orders`
Expected: PASS — all six new cases plus every pre-existing one in the file.

- [ ] **Step 9: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add packages/shared/src/utils/intake-condition-equal.ts \
  packages/shared/src/utils/__tests__/intake-condition-equal.test.ts \
  packages/shared/src/index.ts \
  apps/api/src/modules/intake-orders/intake-orders.service.ts \
  apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts
git commit -m "feat(intake): the office may correct a signed order's phone, and a patch that changes nothing leaves no stamp"
```

---

## Task 2: The stamp says what it can prove

**Files:**

- Modify: `packages/i18n/src/messages/sr.json` + `en.json` (2 rewritten, 1 new)
- Modify: `apps/internal-web/src/features/intake-orders/detail/history-labels.ts:12-20`
- Modify: `docs/25-vehicle-intake.md` (§3.5 print marker, and the amendable-field list)
- Test: `apps/internal-web/src/features/intake-orders/detail/__tests__/history-labels.test.ts`

**Interfaces:**

- Consumes: the transition `'amend_contact_after_signing'` from Task 1.
- Produces: nothing later tasks call. The keys `intake_signature_note_amended` and `intake_amended_hint` keep their names and their parameters — only their text changes, so `tab-overview.tsx` and `intake-orders-table.tsx` need no edit.

- [ ] **Step 1: Write the failing test**

Append to `apps/internal-web/src/features/intake-orders/detail/__tests__/history-labels.test.ts` (read the file first and follow its fixture shape):

```ts
it('names a contact correction, because the history is the only surface that can', () => {
  const entry = historyEntryFixture({ transition: 'amend_contact_after_signing' })

  expect(historyLabel(entry)).toBe(m.intake_history_amended_contact())
  expect(historyLabel(entry)).not.toBe(m.intake_history_generic())
})

it('keeps naming a condition correction exactly as before', () => {
  expect(historyLabel(historyEntryFixture({ transition: 'amend_after_signing' }))).toBe(
    m.intake_history_amended(),
  )
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter internal-web test -- history-labels`
Expected: FAIL — `m.intake_history_amended_contact` does not exist (a TypeScript error in the test run), and an unmapped transition falls through to `intake_history_generic`.

- [ ] **Step 3: Rewrite the two strings and add the third**

`packages/i18n/src/messages/sr.json`:

```json
"intake_amended_hint": "Nalog je menjan posle potpisa",
"intake_signature_note_amended": "Nalog je menjan posle potpisa — {date}, {name}. Odštampani nalog kod mušterije nije identičan ovom zapisu.",
"intake_history_amended_contact": "Telefon vlasnika izmenjen posle potpisa",
```

`packages/i18n/src/messages/en.json`:

```json
"intake_amended_hint": "Order changed after signing",
"intake_signature_note_amended": "The order was changed after signing — {date}, {name}. The printed order the customer holds is not identical to this record.",
"intake_history_amended_contact": "Owner phone changed after signing",
```

`intake_history_amended` and `intake_detail_amended_badge` stay exactly as they are. Keep each key in its existing position in the file, so the diff stays readable.

Then: `pnpm --filter @mr/i18n run compile`

- [ ] **Step 4: Map the transition**

In `history-labels.ts`, add one entry to `TRANSITION_LABELS` and extend the doc comment above it so it still lists what the server writes:

```ts
  amend_after_signing: m.intake_history_amended,
  amend_contact_after_signing: m.intake_history_amended_contact,
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `pnpm --filter internal-web test -- history-labels`
Expected: PASS.

- [ ] **Step 6: Reconcile docs/25**

Two edits, both small:

1. Wherever §3.3.9 / §6 list what a signed order still allows, add `ownerPhone` and the equipment note, and note that the phone stamps as a **contact** amendment while everything about the vehicle stays frozen.
2. In §3.5, the print marker `⚠ ZATEČENO STANJE ISPRAVLJENO POSLE POTPISA` is described neutrally — the printed sheet inherits the same wording as the badge ("Nalog je menjan posle potpisa"), because one stamp column cannot tell the print which kind it was. V-7 must not start from the false sentence.

- [ ] **Step 7: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add packages/i18n/src/messages/sr.json packages/i18n/src/messages/en.json \
  apps/internal-web/src/features/intake-orders/detail/history-labels.ts \
  apps/internal-web/src/features/intake-orders/detail/__tests__/history-labels.test.ts \
  docs/25-vehicle-intake.md
git commit -m "fix(intake): the amendment stamp stops claiming the vehicle's condition changed, and the history names what did"
```

---

## Task 3: Edit mode lives on the page, and the first thing it edits is the phone

The thinnest vertical slice that proves the whole mechanism: enter, lock, change one field, confirm, save, stamp. Tasks 4 and 5 then add fields to a mode that already works.

**Files:**

- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-wizard-state.ts:74` (export `optionalText`)
- Create: `apps/internal-web/src/features/intake-orders/detail/use-intake-amend.ts`
- Create: `apps/internal-web/src/features/intake-orders/detail/intake-amend-bar.tsx`
- Modify: `apps/internal-web/src/routes/_shell/prijem/$id.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/detail/intake-detail-header.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/detail/intake-detail-tabs.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/detail/tab-overview.tsx` (phone fact becomes a field)
- Modify: `packages/i18n/src/messages/sr.json` + `en.json`
- Test: `detail/__tests__/use-intake-amend.test.ts` (new), `detail/__tests__/intake-detail-header.test.tsx`, `detail/__tests__/intake-detail-tabs.test.tsx`

**Interfaces:**

- Consumes: `sameIntakeChecklist`, `sameIntakeDamages` from `@mr/shared` (Task 1).
- Produces, from `use-intake-amend.ts`:
  - `interface IntakeAmendBuffer { ownerPhone: string; fuelLevel: number; checklist: IntakeChecklist; equipmentNote: string; damages: IntakeDamage[] }`
  - `intakeAmendBufferFrom(order: IntakeOrderDetail): IntakeAmendBuffer`
  - `isAmendPhoneValid(value: string): boolean`
  - `intakeAmendDiff(buffer: IntakeAmendBuffer, order: IntakeOrderDetail): IntakeOrderUpdateInput`
  - `interface IntakeAmendEditing { buffer: IntakeAmendBuffer; patch: (next: Partial<IntakeAmendBuffer>) => void; phoneValid: boolean }` — the prop the three card files take. ⚠️ It lives **here**, not in `tab-overview.tsx`: the tab imports the cards, so a type declared in the tab and imported by a card is an import cycle.
  - `useIntakeAmend(order: IntakeOrderDetail): IntakeAmend` where
    `interface IntakeAmend { active: boolean; buffer: IntakeAmendBuffer; patch: (next: Partial<IntakeAmendBuffer>) => void; start: () => void; cancel: () => void; requestSave: () => void; confirmOpen: boolean; setConfirmOpen: (open: boolean) => void; save: () => void; pending: boolean; phoneValid: boolean; losesPhotoNumbers: boolean }`
- Produces: `IntakeDetailTabs` gains `locked?: boolean`; `IntakeDetailHeader` gains `canAmend: boolean`, `amendActive: boolean`, `onStartAmend: () => void`; `TabOverview`, `CardCondition` and `CardDamages` all take the same `amend?: IntakeAmendEditing` (Tasks 4–5 reuse this one optional prop rather than adding new ones).

- [ ] **Step 1: Write the failing test for the diff**

Create `apps/internal-web/src/features/intake-orders/detail/__tests__/use-intake-amend.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  intakeAmendBufferFrom,
  intakeAmendDiff,
  isAmendPhoneValid,
} from '../use-intake-amend.js'
import { intakeOrderDetailFixture } from './render-detail.js'

describe('intakeAmendDiff', () => {
  it('sends nothing when nothing was touched', () => {
    const order = intakeOrderDetailFixture()

    expect(intakeAmendDiff(intakeAmendBufferFrom(order), order)).toEqual({})
  })

  it('sends only the phone when only the phone changed', () => {
    // The whole point of decision ①: a phone correction must not be recorded as a change to the
    // vehicle's condition, and it cannot be one if the request never carries the condition.
    const order = intakeOrderDetailFixture()
    const buffer = { ...intakeAmendBufferFrom(order), ownerPhone: ' +381 64 111 2233 ' }

    expect(intakeAmendDiff(buffer, order)).toEqual({ ownerPhone: '+381 64 111 2233' })
  })

  it('treats a re-typed identical phone as no change', () => {
    const order = intakeOrderDetailFixture()
    const buffer = { ...intakeAmendBufferFrom(order), ownerPhone: `  ${order.ownerPhone}  ` }

    expect(intakeAmendDiff(buffer, order)).toEqual({})
  })

  it('sends an emptied equipment note as null, and only when it really changed', () => {
    const order = intakeOrderDetailFixture({ equipmentNote: 'nema ključa za točkove' })

    expect(intakeAmendDiff({ ...intakeAmendBufferFrom(order), equipmentNote: '   ' }, order)).toEqual({
      equipmentNote: null,
    })
    expect(intakeAmendDiff(intakeAmendBufferFrom(order), order)).toEqual({})
  })

  it('sends the checklist only when a row actually moved', () => {
    const order = intakeOrderDetailFixture()
    const buffer = intakeAmendBufferFrom(order)

    expect(intakeAmendDiff({ ...buffer, checklist: { ...order.checklist } }, order)).toEqual({})
    expect(
      intakeAmendDiff({ ...buffer, checklist: { ...order.checklist, lanci: null } }, order),
    ).toEqual({ checklist: { ...order.checklist, lanci: null } })
  })
})

describe('isAmendPhoneValid', () => {
  it('refuses an emptied phone, which the wire schema requires', () => {
    expect(isAmendPhoneValid('  ')).toBe(false)
    expect(isAmendPhoneValid('12')).toBe(false)
    expect(isAmendPhoneValid('+381 64 111 2233')).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter internal-web test -- use-intake-amend`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook module**

First, in `intake-wizard-state.ts:74`, change `function optionalText` to `export function optionalText` — the diff must trim exactly the way the wizard does.

Create `apps/internal-web/src/features/intake-orders/detail/use-intake-amend.ts`:

```ts
import { m } from '@mr/i18n'
import {
  intakeOrderKeys,
  sameIntakeChecklist,
  sameIntakeDamages,
  updateIntakeOrder,
  type IntakeChecklist,
  type IntakeDamage,
  type IntakeOrderDetail,
  type IntakeOrderUpdateInput,
} from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

import { optionalText } from '../wizard/intake-wizard-state'

/** Only what edit mode may change. Everything else on a signed order is frozen server-side. */
export interface IntakeAmendBuffer {
  ownerPhone: string
  fuelLevel: number
  checklist: IntakeChecklist
  equipmentNote: string
  damages: IntakeDamage[]
}

export function intakeAmendBufferFrom(order: IntakeOrderDetail): IntakeAmendBuffer {
  return {
    ownerPhone: order.ownerPhone,
    fuelLevel: order.fuelLevel,
    checklist: order.checklist,
    equipmentNote: order.equipmentNote ?? '',
    damages: [...order.damages],
  }
}

/** 3–40 characters after trimming — the wire schema's own rule, checked here so the operator
 *  learns WHICH field is wrong. The server answers an unaimed 400 the screen can only report as
 *  "the action failed". */
export function isAmendPhoneValid(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length >= 3 && trimmed.length <= 40
}

/**
 * Only the keys that actually changed. Sending the whole buffer would put `checklist`, `damages`
 * and `fuelLevel` in every request, so correcting a phone number would be recorded as a change to
 * the vehicle's recorded condition — and decision ① would be unreachable in practice.
 */
export function intakeAmendDiff(
  buffer: IntakeAmendBuffer,
  order: IntakeOrderDetail,
): IntakeOrderUpdateInput {
  const phone = buffer.ownerPhone.trim()
  const note = optionalText(buffer.equipmentNote) ?? null

  return {
    ...(phone === order.ownerPhone ? {} : { ownerPhone: phone }),
    ...(buffer.fuelLevel === order.fuelLevel ? {} : { fuelLevel: buffer.fuelLevel }),
    ...(note === order.equipmentNote ? {} : { equipmentNote: note }),
    ...(sameIntakeChecklist(buffer.checklist, order.checklist)
      ? {}
      : { checklist: buffer.checklist }),
    ...(sameIntakeDamages(buffer.damages, order.damages) ? {} : { damages: buffer.damages }),
  }
}

/** What a card needs to be editable. Declared here so a card never imports from its own tab. */
export interface IntakeAmendEditing {
  buffer: IntakeAmendBuffer
  patch: (next: Partial<IntakeAmendBuffer>) => void
  phoneValid: boolean
}

export interface IntakeAmend {
  active: boolean
  buffer: IntakeAmendBuffer
  patch: (next: Partial<IntakeAmendBuffer>) => void
  start: () => void
  cancel: () => void
  requestSave: () => void
  confirmOpen: boolean
  setConfirmOpen: (open: boolean) => void
  save: () => void
  pending: boolean
  phoneValid: boolean
  /** A marker was removed and it had photos — the dialog has to say they lose their number. */
  losesPhotoNumbers: boolean
}

export function useIntakeAmend(order: IntakeOrderDetail): IntakeAmend {
  const queryClient = useQueryClient()
  const [active, setActive] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [buffer, setBuffer] = useState<IntakeAmendBuffer>(() => intakeAmendBufferFrom(order))

  const patch = useCallback((next: Partial<IntakeAmendBuffer>) => {
    setBuffer((prev) => ({ ...prev, ...next }))
  }, [])

  const start = useCallback(() => {
    setBuffer(intakeAmendBufferFrom(order))
    setActive(true)
  }, [order])

  const cancel = useCallback(() => {
    // No question asked: nothing has left the screen, so there is nothing to lose but typing.
    setActive(false)
    setConfirmOpen(false)
  }, [])

  const save = useMutation({
    mutationFn: () => updateIntakeOrder(order.id, intakeAmendDiff(buffer, order)),
    onSuccess: async () => {
      setConfirmOpen(false)
      setActive(false)
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
      showInternalToast(m.intake_amend_saved({ number: order.orderNumber }))
    },
    // The buffer is kept and the mode stays open: the operator's typing is the only copy.
    onError: () => showInternalToast(m.intake_detail_action_failed()),
  })

  const phoneValid = isAmendPhoneValid(buffer.ownerPhone)

  const requestSave = useCallback(() => {
    if (!phoneValid) {
      showInternalToast(m.intake_amend_phone_invalid())
      return
    }
    // Checked BEFORE the dialog: confirming a permanent stamp and then having nothing happen is
    // the worst of both.
    if (Object.keys(intakeAmendDiff(buffer, order)).length === 0) {
      showInternalToast(m.intake_amend_nothing_changed())
      setActive(false)
      return
    }
    setConfirmOpen(true)
  }, [buffer, order, phoneValid])

  const keptIds = new Set(buffer.damages.map((damage) => damage.id))
  const losesPhotoNumbers = order.photos.some(
    (photo) => photo.damageId !== null && !keptIds.has(photo.damageId),
  )

  return {
    active,
    buffer,
    patch,
    start,
    cancel,
    requestSave,
    confirmOpen,
    setConfirmOpen,
    save: save.mutate,
    pending: save.isPending,
    phoneValid,
    losesPhotoNumbers,
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm --filter internal-web test -- use-intake-amend`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the copy**

`sr.json` (and the English pair in `en.json`, same keys, same order):

```json
"intake_amend_start": "Ispravi zatečeno stanje",
"intake_amend_bar_tag": "REŽIM IZMENE",
"intake_amend_bar_note": "Menjaš zapis o zatečenom stanju i telefon vlasnika. Svaka izmena trajno obeležava nalog.",
"intake_amend_cancel": "Otkaži",
"intake_amend_save": "✓ Sačuvaj izmenu",
"intake_amend_confirm_title": "Sačuvati izmenu naloga {number}?",
"intake_amend_confirm_description": "Nalog ostaje trajno obeležen kao menjan posle potpisa, i to obeležje se štampa. Mušterijin odštampani primerak više neće biti identičan ovom zapisu.",
"intake_amend_confirm_photos": "Obrisao si oštećenje koje ima fotografije — one ostaju, ali gube svoj broj.",
"intake_amend_confirm_button": "Sačuvaj izmenu",
"intake_amend_saved": "Nalog {number} je izmenjen i obeležen.",
"intake_amend_nothing_changed": "Ništa nije promenjeno — nalog nije obeležen.",
"intake_amend_phone_invalid": "Telefon vlasnika ne sme da ostane prazan.",
"intake_amend_locked": "Zatvori režim izmene da bi ovo bilo dostupno.",
```

English side:

```json
"intake_amend_start": "Correct the recorded condition",
"intake_amend_bar_tag": "EDIT MODE",
"intake_amend_bar_note": "You are changing the recorded condition and the owner's phone. Every change marks the order permanently.",
"intake_amend_cancel": "Cancel",
"intake_amend_save": "✓ Save the change",
"intake_amend_confirm_title": "Save the change to order {number}?",
"intake_amend_confirm_description": "The order stays permanently marked as changed after signing, and that mark is printed. The customer's printed copy will no longer be identical to this record.",
"intake_amend_confirm_photos": "You removed a defect that has photos — they stay, but they lose their number.",
"intake_amend_confirm_button": "Save the change",
"intake_amend_saved": "Order {number} was changed and marked.",
"intake_amend_nothing_changed": "Nothing changed — the order was not marked.",
"intake_amend_phone_invalid": "The owner's phone cannot be left empty.",
"intake_amend_locked": "Close edit mode to use this.",
```

Then: `pnpm --filter @mr/i18n run compile`

- [ ] **Step 6: Write the failing header and tabs tests**

In `detail/__tests__/intake-detail-header.test.tsx` (match the existing render helper and prop shape):

```ts
it('offers the correction only to somebody who may amend a live signed order', async () => {
  await renderDetailUi(
    <IntakeDetailHeader
      order={intakeOrderDetailFixture()}
      canAdvance
      canDelete
      canChangeStatus
      canAmend
      amendActive={false}
      onStartAmend={() => {}}
    />,
  )

  expect(screen.getByRole('button', { name: m.intake_amend_start() })).toBeDefined()
})

it('shows no correction button on an unfinished intake, which the wizard still owns', async () => {
  await renderDetailUi(
    <IntakeDetailHeader
      order={intakeDraftFixture()}
      canAdvance
      canDelete
      canChangeStatus
      canAmend
      amendActive={false}
      onStartAmend={() => {}}
    />,
  )

  expect(screen.queryByRole('button', { name: m.intake_amend_start() })).toBeNull()
})

it('locks advance and remove while the mode is open, so one edit is one edit', async () => {
  await renderDetailUi(
    <IntakeDetailHeader
      order={intakeOrderDetailFixture()}
      canAdvance
      canDelete
      canChangeStatus
      canAmend
      amendActive
      onStartAmend={() => {}}
    />,
  )

  expect(screen.getByRole('button', { name: m.intake_detail_remove() })).toBeDisabled()
  expect(screen.queryByRole('button', { name: m.intake_amend_start() })).toBeNull()
})
```

In `detail/__tests__/intake-detail-tabs.test.tsx`:

```ts
it('turns the strip inert while edit mode is open — a tab change unmounts the buffer', async () => {
  await renderDetailUi(
    <IntakeDetailTabs order={intakeOrderDetailFixture()} activeTab={IntakeDetailTab.Pregled} locked />,
  )

  expect(screen.queryAllByRole('link')).toHaveLength(0)
  expect(screen.getByText(m.intake_tab_istorija())).toBeDefined()
})
```

Run both: `pnpm --filter internal-web test -- intake-detail-header intake-detail-tabs` → FAIL (unknown props).

- [ ] **Step 7: Implement the header, the tabs and the bar**

`intake-detail-header.tsx` — extend `IntakeDetailHeaderProps` with `canAmend: boolean`, `amendActive: boolean`, `onStartAmend: () => void`. Add the button before the advance button, and pass `disabled={amendActive}` to advance and remove:

```tsx
{canAmend && isLive && !amendActive ? (
  <InternalButton
    type="button"
    variant="ghost"
    onClick={onStartAmend}
    className={cn(
      ACTION_CLASSES,
      'border border-[rgba(245,165,36,0.45)] bg-[rgba(245,165,36,0.12)] font-extrabold tracking-[0.06em] text-mri-amb hover:bg-[rgba(245,165,36,0.2)]',
    )}
  >
    {m.intake_amend_start()}
  </InternalButton>
) : null}
```

Values from spec §3.4: height 46, padding 0 18, radius 10, 13px — all four already in `ACTION_CLASSES` and `InternalButton`'s base. The base is `font-bold tracking-[0.08em]`, so weight 800 and tracking `.06em` are the two the class list above adds; nothing else.

`intake-detail-tabs.tsx` — add `locked = false` to the props and render a `<span>` in place of the `<Link>` when locked, keeping the same classes plus `aria-disabled="true"` and `title={m.intake_amend_locked()}`. Spans, not `preventDefault` on links: a middle click must not open a tab either.

Create `intake-amend-bar.tsx`:

```tsx
/**
 * The strip that says the screen is in a different mode, with the only two ways out. Its amber is
 * the same pair of literals the draft bar and the photos note already use — the tone means "this
 * order is not in its resting state", and a third colour would read as a third meaning.
 */
export function IntakeAmendBar({
  onCancel,
  onSave,
  pending,
}: {
  onCancel: () => void
  onSave: () => void
  pending: boolean
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-[14px] rounded-[12px] border border-[rgba(245,165,36,0.4)] bg-[rgba(245,165,36,0.09)] px-4 py-[13px]">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-mri-amb">
        {m.intake_amend_bar_tag()}
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] leading-[1.5] text-mri-text">
        {m.intake_amend_bar_note()}
      </span>
      <div className="flex flex-none gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 cursor-pointer rounded-[9px] border border-mri-border2 bg-transparent px-4 font-mono text-xs font-bold uppercase tracking-[0.06em] text-mri-text2"
        >
          {m.intake_amend_cancel()}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="h-11 cursor-pointer rounded-[9px] border border-[rgba(31,169,113,0.45)] bg-[rgba(31,169,113,0.16)] px-5 font-mono text-xs font-extrabold uppercase tracking-[0.06em] text-mri-ok disabled:cursor-not-allowed disabled:opacity-60"
        >
          {m.intake_amend_save()}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Wire the page**

In `routes/_shell/prijem/$id.tsx`, inside `IntakeDetailPage`:

```tsx
const navigate = useNavigate()
const amend = useIntakeAmend(order)
const canAmend = permissions.includes('intake_orders.amend')

const startAmend = (): void => {
  // Explicit, and `replace`: the button is reachable from every tab, and the buffer only has a
  // body to live in on Pregled. Without this, pressing it from Fotografije mounts nothing.
  void navigate({ to: '/prijem/$id', params: { id }, search: { tab: IntakeDetailTab.Pregled }, replace: true })
  amend.start()
}
```

Header gets `canAmend={canAmend}`, `amendActive={amend.active}`, `onStartAmend={startAmend}`.
The bar renders directly under the header when `amend.active`.
`IntakeStatusBar` renders only when `!amend.active` — it is a bar of buttons that each fire immediately, and the spec locks every header action while the mode is open.
`IntakeDetailTabs` gets `locked={amend.active}`.
`TabOverview` gets `amend={amend.active ? { buffer: amend.buffer, patch: amend.patch, phoneValid: amend.phoneValid } : undefined}`.

And the confirmation, as a sibling of the tabs:

```tsx
<ConfirmDialog
  open={amend.confirmOpen}
  onOpenChange={amend.setConfirmOpen}
  variant="default"
  title={m.intake_amend_confirm_title({ number: order.orderNumber })}
  description={
    amend.losesPhotoNumbers
      ? `${m.intake_amend_confirm_description()} ${m.intake_amend_confirm_photos()}`
      : m.intake_amend_confirm_description()
  }
  confirmLabel={m.intake_amend_confirm_button()}
  pending={amend.pending}
  onConfirm={amend.save}
/>
```

⚠️ Two strings joined with a space, never a translated sentence built from fragments — both halves are whole sentences in both languages.

- [ ] **Step 9: Make the phone editable in the Pregled card**

In `tab-overview.tsx`, add the optional prop and swap that one fact's value:

```tsx
export function TabOverview({
  order,
  amend,
}: {
  order: IntakeOrderDetail
  amend?: IntakeAmendEditing
})
```

The facts array is built from `order`; in edit mode the phone entry's `value` becomes an input:

```tsx
{
  label: m.intake_field_owner_phone(),
  value:
    amend === undefined ? (
      order.ownerPhone
    ) : (
      <input
        type="tel"
        value={amend.buffer.ownerPhone}
        onChange={(event) => amend.patch({ ownerPhone: event.target.value })}
        aria-label={m.intake_field_owner_phone()}
        aria-invalid={!amend.phoneValid}
        className={cn(
          'mri-input h-11 w-full rounded-[9px] px-3 font-mono text-sm',
          amend.phoneValid ? '' : 'border-mri-red',
        )}
      />
    ),
  className: 'font-mono font-medium',
}
```

⚠️ `facts` is typed as `{ label: string; value: string; className: string }[]` today — widen `value` to `ReactNode`. The cell already renders `{fact.value}` inside a `<div>`, so nothing else moves.

- [ ] **Step 10: Run the whole internal-web suite**

Run: `pnpm --filter internal-web test`
Expected: PASS. The header and tabs tests from Step 6 now pass; the existing `tab-overview` tests still pass because `amend` is optional and the read view is untouched.

- [ ] **Step 11: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src packages/i18n/src/messages
git commit -m "feat(intake): the office opens an edit mode on a signed order, and the phone is the first thing it corrects"
```

---

## Task 4: The condition card becomes editable in place

**Files:**

- Create: `apps/internal-web/src/features/intake-orders/detail/card-condition.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/detail/tab-overview.tsx` (delegate the card, add the fuel stepper)
- Modify: `packages/i18n/src/messages/sr.json` + `en.json`
- Test: `apps/internal-web/src/features/intake-orders/detail/__tests__/tab-overview.test.tsx`

**Interfaces:**

- Consumes: `IntakeAmendEditing` from Task 3.
- Produces: `CardCondition({ order, amend }: { order: IntakeOrderDetail; amend?: IntakeAmendEditing }): ReactElement` — the same card in both modes, so the read view cannot drift from the edit view.

- [ ] **Step 1: Write the failing tests**

Append to `detail/__tests__/tab-overview.test.tsx`:

```ts
it('turns the condition card into live DA/NE controls in edit mode', async () => {
  const order = intakeOrderDetailFixture()
  const patch = vi.fn()

  await renderDetailUi(
    <TabOverview
      order={order}
      amend={{ buffer: intakeAmendBufferFrom(order), patch, phoneValid: true }}
    />,
  )

  const group = screen.getByRole('group', { name: INTAKE_CHECKLIST_LABELS.lanci() })
  fireEvent.click(within(group).getByText(m.intake_checklist_yes()))

  expect(patch).toHaveBeenCalledWith({ checklist: { ...order.checklist, lanci: true } })
})

it('keeps the third state: tapping the active side again clears the row', async () => {
  // The prototype's DA/NE control cannot do this, and without it the office can mark a document
  // "NE" by mistake with no way back — on evidence a customer signed.
  const order = intakeOrderDetailFixture()
  const patch = vi.fn()

  await renderDetailUi(
    <TabOverview
      order={order}
      amend={{ buffer: intakeAmendBufferFrom(order), patch, phoneValid: true }}
    />,
  )

  const group = screen.getByRole('group', { name: INTAKE_CHECKLIST_LABELS.dizalica() })
  fireEvent.click(within(group).getByText(m.intake_checklist_yes()))

  expect(patch).toHaveBeenCalledWith({ checklist: { ...order.checklist, dizalica: null } })
})

it('edits the equipment note, which the server has allowed since V-6-1', async () => {
  const order = intakeOrderDetailFixture({ equipmentNote: null })
  const patch = vi.fn()

  await renderDetailUi(
    <TabOverview
      order={order}
      amend={{ buffer: intakeAmendBufferFrom(order), patch, phoneValid: true }}
    />,
  )

  fireEvent.change(screen.getByLabelText(m.intake_field_equipment_note()), {
    target: { value: 'nema ključa za točkove' },
  })

  expect(patch).toHaveBeenCalledWith({ equipmentNote: 'nema ključa za točkove' })
})

it('steps the fuel level, and refuses to walk past either end of the gauge', async () => {
  const order = intakeOrderDetailFixture({ fuelLevel: 8 })
  const patch = vi.fn()

  await renderDetailUi(
    <TabOverview
      order={order}
      amend={{ buffer: intakeAmendBufferFrom(order), patch, phoneValid: true }}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: m.intake_fuel_more() }))
  expect(patch).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: m.intake_fuel_less() }))
  expect(patch).toHaveBeenCalledWith({ fuelLevel: 7 })
})
```

⚠️ `dizalica` is `true` in the shared fixture (`render-detail.tsx:40`) — that is what makes the second test a real third-state check. If the fixture changes, re-pick a key that is `true`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter internal-web test -- tab-overview`
Expected: FAIL — no `group` role in the read-only card, no note field, no fuel buttons.

- [ ] **Step 3: Add the two fuel labels**

`sr.json`: `"intake_fuel_less": "Manje goriva"`, `"intake_fuel_more": "Više goriva"`.
`en.json`: `"intake_fuel_less": "Less fuel"`, `"intake_fuel_more": "More fuel"`.
Then `pnpm --filter @mr/i18n run compile`.

- [ ] **Step 4: Extract and extend the card**

Create `card-condition.tsx` by moving the existing "Zatečeno stanje" `<section>` out of `tab-overview.tsx:257-292` verbatim — including `conditionMark`, which moves with it — then add the edit branch:

```tsx
/**
 * "Zatečeno stanje", read and corrected by the same card. The prototype draws a NEW card for the
 * checklist in edit mode; we already have this one, and a second would render the eight rows twice
 * on one screen — one dead, one live, a finger apart.
 */
export function CardCondition({
  order,
  amend,
}: {
  order: IntakeOrderDetail
  amend?: IntakeAmendEditing
}): ReactElement {
  const checklist = amend === undefined ? order.checklist : amend.buffer.checklist
  const unchecked = INTAKE_CHECKLIST_KEYS.length - countConfirmed(checklist)
  // ...
  {amend === undefined ? (
    <div className="grid grid-cols-2 gap-4 @min-[860px]:grid-cols-4">{/* the ✓/✗/— read grid */}</div>
  ) : (
    <IntakeChecklistGrid
      checklist={amend.buffer.checklist}
      onChange={(next) => amend.patch({ checklist: next })}
    />
  )}

  {amend === undefined ? (
    order.equipmentNote === null ? null : (
      <p className="mt-3.5 text-[13.5px] italic text-mri-text2">{order.equipmentNote}</p>
    )
  ) : (
    <label className="mt-3.5 block">
      <span className={cn(FIELD_KEY, 'mb-[5px] block')}>{m.intake_field_equipment_note()}</span>
      <input
        type="text"
        value={amend.buffer.equipmentNote}
        onChange={(event) => amend.patch({ equipmentNote: event.target.value })}
        placeholder={m.intake_field_equipment_note_placeholder()}
        className="mri-input h-11 w-full rounded-[9px] px-3 text-sm"
      />
    </label>
  )}
```

⚠️ Reuse `IntakeChecklistGrid` as it is — 62px buttons, not the prototype's 52×44. The size is the price of the third state, and it is a recorded divergence (spec §5.4). Do not re-implement a DA/NE pair to hit the number.

⚠️ `FIELD_KEY` currently lives in `tab-overview.tsx`; move it into `detail-styles.ts` and import it in both files rather than declaring it twice.

- [ ] **Step 5: Add the fuel stepper to the basics card**

In `tab-overview.tsx`, the "Gorivo" fact in edit mode:

```tsx
{
  label: m.intake_fact_fuel(),
  value:
    amend === undefined ? (
      fuelRecorded ? m.intake_fact_fuel_value({ level: order.fuelLevel }) : DASH
    ) : (
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => amend.patch({ fuelLevel: Math.max(0, amend.buffer.fuelLevel - 1) })}
          disabled={amend.buffer.fuelLevel === 0}
          aria-label={m.intake_fuel_less()}
          className="size-11 flex-none cursor-pointer rounded-[9px] bg-mri-inbg font-mono text-[17px] font-semibold text-mri-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          {'−'}
        </button>
        <span className="font-mono text-[26px] font-extrabold text-mri-text">
          {amend.buffer.fuelLevel}
        </span>
        <span className="text-base text-mri-text2">/8</span>
        <button
          type="button"
          onClick={() => amend.patch({ fuelLevel: Math.min(8, amend.buffer.fuelLevel + 1) })}
          disabled={amend.buffer.fuelLevel === 8}
          aria-label={m.intake_fuel_more()}
          className="size-11 flex-none cursor-pointer rounded-[9px] bg-mri-inbg font-mono text-[17px] font-semibold text-mri-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </span>
    ),
  className: 'font-mono font-semibold',
}
```

⚠️ `−` is a real minus sign, not a hyphen — spec §3.4 names it. ⚠️ The `disabled` at both ends is what makes the test's "does not walk past 8" assertion meaningful; clamping alone would call `patch` with the same number and leave a stamp-worthy diff of nothing (the diff builder would drop it, but the operator would see a dead button that reports success).

- [ ] **Step 6: Run the tests and watch them pass**

Run: `pnpm --filter internal-web test -- tab-overview`
Expected: PASS — the four new cases and every pre-existing one (the read view must not have moved).

- [ ] **Step 7: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src packages/i18n/src/messages
git commit -m "feat(intake): the condition card is corrected where it is read, and the third state survives"
```

---

## Task 5: The diagram takes a marker, and a defect row gives one up

**Files:**

- Create: `apps/internal-web/src/features/intake-orders/detail/card-damages.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/detail/tab-overview.tsx` (delegate the card; feed the photo grid from the buffer)
- Modify: `packages/i18n/src/messages/sr.json` + `en.json`
- Test: `apps/internal-web/src/features/intake-orders/detail/__tests__/tab-overview.test.tsx`

**Interfaces:**

- Consumes: `IntakeAmendEditing` (Task 3), `newDamageId` and `intakeDamageZoneOf` (existing), `IntakeDamageMap` with `onPlace` (existing, `intake-damage-map.tsx:52`).
- Produces: `CardDamages({ order, amend }): ReactElement`.

- [ ] **Step 1: Write the failing tests**

Append to `detail/__tests__/tab-overview.test.tsx`:

```ts
it('drops a marker of the selected type where the diagram is tapped', async () => {
  const order = intakeOrderDetailFixture({ damages: [] })
  const patch = vi.fn()

  await renderDetailUi(
    <TabOverview
      order={order}
      amend={{ buffer: intakeAmendBufferFrom(order), patch, phoneValid: true }}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: INTAKE_DAMAGE_TYPE_LABELS.dent() }))
  fireEvent.click(screen.getByRole('button', { name: m.intake_map_aria() }))

  const [[next]] = patch.mock.calls
  expect(next.damages).toHaveLength(1)
  expect(next.damages[0].type).toBe(IntakeDamageType.Dent)
  expect(next.damages[0].zone.length).toBeGreaterThan(0)
})

it('removes a defect row without asking, because nothing has left the screen yet', async () => {
  const damage = { id: 'd1', type: IntakeDamageType.Scratch, x: 100, y: 60, zone: 'Prednja leva' }
  const order = intakeOrderDetailFixture({ damages: [damage] })
  const patch = vi.fn()

  await renderDetailUi(
    <TabOverview
      order={order}
      amend={{ buffer: intakeAmendBufferFrom(order), patch, phoneValid: true }}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: m.intake_damage_remove() }))

  expect(patch).toHaveBeenCalledWith({ damages: [] })
})

it('numbers the photos from the buffer, not from the stored order', async () => {
  // Otherwise the badges keep showing the numbering from before the edit while the list beside
  // them already renumbered — two answers to one question, on the same screen.
  const damage = { id: 'd1', type: IntakeDamageType.Scratch, x: 100, y: 60, zone: 'Prednja leva' }
  const order = intakeOrderDetailFixture({
    damages: [damage],
    photos: [photoFixture({ damageId: 'd1' })],
  })

  await renderDetailUi(
    <TabOverview
      order={order}
      amend={{ buffer: { ...intakeAmendBufferFrom(order), damages: [] }, patch: vi.fn(), phoneValid: true }}
    />,
  )

  expect(screen.queryByText('1')).toBeNull()
})
```

⚠️ `photoFixture` may not exist in `render-detail.tsx`. Read the file; if it does not, add the smallest one that parses through the wire schema, next to `intakeOrderDetailFixture`.
⚠️ `INTAKE_DAMAGE_TYPE_LABELS` keys are the real `IntakeDamageType` values — read `intake-labels.ts` and use them, do not assume `dent`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter internal-web test -- tab-overview`
Expected: FAIL — the diagram is read-only (`role="img"`, no `onPlace`), there is no type picker, and the defect rows carry no ✕.

- [ ] **Step 3: Add the copy**

`sr.json`: `"intake_damage_type_pick": "Vrsta oštećenja"`. `en.json`: `"intake_damage_type_pick": "Defect type"`. `intake_damage_remove` and `intake_map_aria` already exist — reuse them. Then `pnpm --filter @mr/i18n run compile`.

- [ ] **Step 4: Extract and extend the card**

Create `card-damages.tsx` by moving the "Šema" + "Nedostaci" `<section>` (`tab-overview.tsx:204-255`) verbatim, then add the edit branch:

```tsx
export function CardDamages({
  order,
  amend,
}: {
  order: IntakeOrderDetail
  amend?: IntakeAmendEditing
}): ReactElement {
  const [damageType, setDamageType] = useState<IntakeDamageType>(IntakeDamageType.Scratch)
  const damages = amend === undefined ? order.damages : amend.buffer.damages

  const place = (point: { x: number; y: number }): void => {
    if (amend === undefined) {
      return
    }
    amend.patch({
      damages: [
        ...amend.buffer.damages,
        {
          id: newDamageId(),
          type: damageType,
          x: point.x,
          y: point.y,
          // The server derives the zone again and overwrites it, but the wire schema requires a
          // non-empty one, so a missing value fails in Zod before that ever runs.
          zone: intakeDamageZoneOf(order.vehicleType, point.x, point.y),
        },
      ],
    })
  }
  // <IntakeDamageMap vehicleType={order.vehicleType} damages={damages} variant="detail"
  //   {...(amend === undefined ? {} : { onPlace: place })} />
```

Under the diagram, in edit mode only, the 2×2 type picker (spec §3.4: 170px wide, 40px high, gap 6, radius 8, 11.5px; selected → `rgba(237,28,36,0.13)` fill, `rgba(237,28,36,0.42)` border, `text-mri-redh`, bold):

```tsx
<div className="grid w-[170px] grid-cols-2 gap-[6px]" role="group" aria-label={m.intake_damage_type_pick()}>
  {intakeDamageTypeValues.map((type) => (
    <button
      key={type}
      type="button"
      onClick={() => setDamageType(type)}
      aria-pressed={damageType === type}
      className={cn(
        'h-10 cursor-pointer rounded-[8px] border text-[11.5px] transition-colors',
        damageType === type
          ? 'border-[rgba(237,28,36,0.42)] bg-[rgba(237,28,36,0.13)] font-bold text-mri-redh'
          : 'border-mri-border2 bg-mri-inbg font-semibold text-mri-text2',
      )}
    >
      {INTAKE_DAMAGE_TYPE_LABELS[type]()}
    </button>
  ))}
</div>
```

And each defect row, in edit mode, gains the ✕ (34×40, transparent, `text-mri-text2`, 15px) that removes it with no dialog:

```tsx
{amend === undefined ? null : (
  <button
    type="button"
    onClick={() =>
      amend.patch({ damages: amend.buffer.damages.filter((row) => row.id !== damage.id) })
    }
    aria-label={m.intake_damage_remove()}
    className="h-10 w-[34px] flex-none cursor-pointer text-[15px] text-mri-text2"
  >
    ✕
  </button>
)}
```

⚠️ No `ConfirmDialog` per ✕ — the whole buffer is thrown away by "Otkaži", so a per-marker confirmation would confirm nothing. This is deliberately unlike the wizard, where ✕ deletes immediately (spec §3.3). The photos of a removed marker are kept by the server and lose only their number; that is what the save dialog's second sentence tells the operator.

- [ ] **Step 5: Feed the photo grid from the buffer**

In `tab-overview.tsx`, the Pregled photo card builds its cells with `buildPhotoCells(order.id, order.photos, [], order.damages)`. In edit mode the last argument becomes `amend.buffer.damages`, so a marker removed a second ago stops numbering its photos immediately.

- [ ] **Step 6: Run the tests and watch them pass**

Run: `pnpm --filter internal-web test -- tab-overview`
Expected: PASS.

- [ ] **Step 7: Check the file sizes**

Run: `wc -l apps/internal-web/src/features/intake-orders/detail/*.tsx`
Expected: every file under 500 lines; `tab-overview.tsx` should now be well under its previous 368.

- [ ] **Step 8: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src packages/i18n/src/messages
git commit -m "feat(intake): the diagram takes a marker and a defect row gives one up, both inside the buffer"
```

---

## Task 6: Photos — added and removed straight away, outside the mode

**Files:**

- Create: `apps/internal-web/src/features/intake-orders/wizard/intake-photo-picker.tsx`
- Create: `apps/internal-web/src/features/intake-orders/wizard/intake-photo-cell-state.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-photo-grid.tsx` (use both; no behaviour change)
- Modify: `apps/internal-web/src/features/intake-orders/wizard/use-intake-photo-queue.ts` (optional `onFailure`)
- Modify: `apps/internal-web/src/features/intake-orders/detail/tab-photos.tsx`
- Modify: `apps/internal-web/src/routes/_shell/prijem/$id.tsx` (own the queue, pass it down)
- Modify: `packages/i18n/src/messages/sr.json` + `en.json`
- Test: `detail/__tests__/tab-photos.test.tsx`, `wizard/__tests__/use-intake-photo-queue.test.tsx`

**Interfaces:**

- Consumes: `useIntakePhotoQueue(orderId)` (existing), `buildPhotoCells` (existing), `IntakePhotoLightbox`'s `onDelete` (existing, `intake-photo-lightbox.tsx:17`).
- Produces:
  - `useIntakePhotoPicker(onPick: (files: readonly File[]) => void): { openCamera: () => void; openGallery: () => void; inputs: ReactElement }`
  - `photoCellBorderClass(state: IntakePhotoUploadState): string` and `IntakePhotoCellOverlay({ cell }: { cell: IntakePhotoCell }): ReactElement | null`
  - `useIntakePhotoQueue(orderId, options?: { onFailure?: (state: 'wait' | 'err') => void })`
  - `TabPhotos({ order, queue, canAddPhotos, isOrderTechnician })`

- [ ] **Step 1: Write the failing tests**

In `detail/__tests__/tab-photos.test.tsx`:

```ts
it('offers no camera without both amend and update, whatever the route would answer', async () => {
  // A role built in admin with `amend` but no `update` would get a "+" whose every tap is a 403
  // from the route.
  await renderDetailUi(
    <TabPhotos
      order={intakeOrderDetailFixture()}
      queue={emptyQueueStub()}
      canAddPhotos={false}
      isOrderTechnician={false}
    />,
  )

  expect(screen.queryByRole('button', { name: m.intake_photo_add() })).toBeNull()
})

it('warns about the permanent mark when the office adds a photo', async () => {
  await renderDetailUi(
    <TabPhotos
      order={intakeOrderDetailFixture()}
      queue={emptyQueueStub()}
      canAddPhotos
      isOrderTechnician={false}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: m.intake_photo_add() }))

  expect(screen.getByText(m.intake_photo_add_stamp_warning())).toBeDefined()
})

it('does not warn when the order\'s own serviser adds one, because the server stamps nothing', async () => {
  // A late arrival from the order's own technician is part of the intake, not an amendment
  // (`intake-orders.service.ts:647-651`). Promising a permanent mark that never happens is the
  // dialog lying to the one person who reads it.
  await renderDetailUi(
    <TabPhotos
      order={intakeOrderDetailFixture()}
      queue={emptyQueueStub()}
      canAddPhotos
      isOrderTechnician
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: m.intake_photo_add() }))

  expect(screen.queryByText(m.intake_photo_add_stamp_warning())).toBeNull()
})

it('discards the queue entry alongside the server row, so a deleted photo does not come back', async () => {
  // The queue does not clear landed entries — the grid only hides them once the server lists the
  // photo. Deleting without `discard` puts the photo back on screen as an upload in flight.
  const discard = vi.fn()
  const queue = { ...emptyQueueStub(), discard, entries: [queueEntryStub({ id: 'q1', attachmentId: 'a1' })] }
  // ...open the lightbox on that cell, confirm the deletion
  expect(discard).toHaveBeenCalledWith('q1')
})
```

In `wizard/__tests__/use-intake-photo-queue.test.tsx`, add one case: a failing upload calls `onFailure` with `'err'` (network refusal → `'wait'`). Follow the file's existing mocking of `uploadIntakePhoto`.

⚠️ `emptyQueueStub` / `queueEntryStub` do not exist. Put them in `detail/__tests__/render-detail.tsx` next to the order fixtures — `TabPhotos` takes the queue as a prop precisely so a test does not have to run the real one.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter internal-web test -- tab-photos use-intake-photo-queue`
Expected: FAIL — `TabPhotos` takes only `order`.

- [ ] **Step 3: Add the copy**

`sr.json`:

```json
"intake_photo_add": "Dodaj fotografiju",
"intake_photo_add_title": "Dodati fotografiju nalogu {number}?",
"intake_photo_add_description": "Fotografija se odmah dodaje nalogu.",
"intake_photo_add_stamp_warning": "Nalog ostaje trajno obeležen kao menjan posle potpisa, i to obeležje se štampa.",
"intake_photo_delete_title": "Obrisati fotografiju sa naloga {number}?",
"intake_photo_delete_description": "Fotografija se briše odmah i ne može da se vrati. Nalog ostaje trajno obeležen kao menjan posle potpisa.",
"intake_photo_deleted": "Fotografija je obrisana.",
"intake_photo_upload_failed": "Fotografija nije poslata. Otvori tab Fotografije i pokušaj ponovo.",
```

`en.json`:

```json
"intake_photo_add": "Add a photo",
"intake_photo_add_title": "Add a photo to order {number}?",
"intake_photo_add_description": "The photo is added to the order straight away.",
"intake_photo_add_stamp_warning": "The order stays permanently marked as changed after signing, and that mark is printed.",
"intake_photo_delete_title": "Delete a photo from order {number}?",
"intake_photo_delete_description": "The photo is deleted straight away and cannot be brought back. The order stays permanently marked as changed after signing.",
"intake_photo_deleted": "The photo was deleted.",
"intake_photo_upload_failed": "The photo was not sent. Open the Fotografije tab and try again.",
```

Then `pnpm --filter @mr/i18n run compile`.

- [ ] **Step 4: Extract the picker and the cell state**

`intake-photo-picker.tsx` — move the two hidden `<input type="file">` elements and the `pick` helper out of `intake-photo-grid.tsx:114-126,231-247` unchanged:

```tsx
/**
 * The camera and gallery inputs, and the two ways to open them. A native file input, never
 * `getUserMedia`: that demands a secure context, and the tablet reaches the dev server over plain
 * http on the hall LAN (docs/25 §3.8). `capture` is the whole difference between the two.
 */
export function useIntakePhotoPicker(onPick: (files: readonly File[]) => void): {
  openCamera: () => void
  openGallery: () => void
  inputs: ReactElement
}
```

`intake-photo-cell-state.tsx` — move `STATE_BORDER`, `STATE_VEIL`, `STATE_TEXT` and the overlay JSX (`intake-photo-grid.tsx:25-44,170-191`) into `photoCellBorderClass(state)` and `<IntakePhotoCellOverlay cell={cell} />`.

Then rewrite `intake-photo-grid.tsx` to use both. **Its rendered output must not change** — the wizard's step 3 is shipped and in daily use.

Run: `pnpm --filter internal-web test -- intake-photo-grid step-damage-photos`
Expected: PASS with no test edits. If a wizard test turns red, the extraction changed behaviour — fix the extraction, not the test.

- [ ] **Step 5: Add the failure callback to the queue**

In `use-intake-photo-queue.ts`, the signature becomes:

```ts
export function useIntakePhotoQueue(
  orderId: string | null,
  options: { onFailure?: (state: 'wait' | 'err') => void } = {},
): IntakePhotoQueue
```

and the `.catch` branch calls `options.onFailure?.(reason)` after `patch`. The wizard passes nothing and keeps its chip; the detail passes a toast, because the cell is the only existing report of a failure and the operator does not have to be standing on that tab.

⚠️ Keep `options` out of the `useCallback` dependency array by reading it through a ref, or the identity of a fresh object literal re-creates `send` on every render and the online-listener effect re-subscribes each time.

- [ ] **Step 6: Rewrite the photos tab**

`TabPhotos` takes `{ order, queue, canAddPhotos, isOrderTechnician }`, builds its cells with `buildPhotoCells(order.id, order.photos, queue.entries, order.damages)`, renders `photoCellBorderClass` + `<IntakePhotoCellOverlay>` on each cell, and adds — only when `canAddPhotos` — a `+` cell in the same 4-column grid plus the picker's inputs. Both actions are confirmed by a `ConfirmDialog` owned by this component:

- **Add:** confirm first (title `intake_photo_add_title`, description `intake_photo_add_description` — joined with `intake_photo_add_stamp_warning` unless `isOrderTechnician`, because the server treats the order's own technician as a late arrival and stamps nothing, `intake-orders.service.ts:647-651`), then `openCamera()`; the picked files go to `queue.enqueue(files, null)`.
- **Delete:** the lightbox gets `onDelete` only when `canAddPhotos`; the confirmation stands at this caller, not inside the lightbox (the wizard's behaviour must not change). On confirm: `deleteIntakeOrderPhoto(order.id, cell.attachmentId)` → `queue.discard(cell.entryId)` when the cell has one → invalidate `intakeOrderKeys.all` → toast.

⚠️ **The Pregled tab's lightbox stays without `onDelete`.** One action lives in one place; a photo is removed in Fotografije and nowhere else. `tab-overview.tsx` is not touched by this task.

- [ ] **Step 7: Own the queue on the page**

In `$id.tsx`:

```tsx
const photoQueue = useIntakePhotoQueue(order.id, {
  onFailure: () => showInternalToast(m.intake_photo_upload_failed()),
})
```

⚠️ It must live here, not inside `TabPhotos`. The tab body unmounts on every tab change, and with it would go the in-flight cell, its retry and the `online` listener — while `photos_expected` only rises after a successful upload (`intake-orders.service.ts:682-685`), so a failed office upload would leave no trace on the screen or on the server.

`TabPhotos` gets `queue={photoQueue}`, `canAddPhotos={permissions.includes('intake_orders.amend') && permissions.includes('intake_orders.update') && order.signedAt !== null && order.deletedAt === null}` and `isOrderTechnician={session?.user?.id === order.technicianId}`.

- [ ] **Step 8: Run the tests and watch them pass**

Run: `pnpm --filter internal-web test`
Expected: PASS, including every wizard photo test untouched.

- [ ] **Step 9: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src packages/i18n/src/messages
git commit -m "feat(intake): the office adds and removes photos on a signed order, and a failed upload survives a tab change"
```

---

## Task 7: Measure, then hand over

No new behaviour. This task exists because the previous one of its kind found three real defects that no test could have caught, and because a green suite proves nothing until the line it covers is broken.

**Files:**

- Modify: `docs/25-vehicle-intake.md`, `.superpowers/sdd/2026-07-29-intake-detail-v6/progress.md` (only if measuring finds something)

- [ ] **Step 1: Mutation-test the money paths**

Break each of these one at a time, run the named suite, and confirm the expected test — not merely *a* test — turns red. Restore the line before the next one.

| Break | Expect red |
|---|---|
| `withoutUnchanged` returns `patch` unchanged | "does not stamp a signed order when every value in the patch is what it already holds" |
| `classifyPostSigningPatch` returns `'condition'` for a contact-only patch | "lets the office correct the owner phone, and stamps it as a contact amendment" |
| `classifyPostSigningPatch` returns `'contact'` when both buckets are touched | "writes one history row when a request touches both the condition and the phone" |
| `intakeAmendDiff` returns the whole buffer | "sends only the phone when only the phone changed" |
| `sameIntakeDamages` compares length only | "sees a moved, retyped, added or removed marker" |
| `IntakeChecklistGrid`'s `set` drops the third state | "keeps the third state: tapping the active side again clears the row" |
| `TabPhotos` deletes without `queue.discard` | "discards the queue entry alongside the server row" |

⚠️ A mutation that leaves everything green is a finding — the test is asserting something else. Report it; do not paper over it.

- [ ] **Step 2: Walk it in the browser at 1180×820**

Nikola's office iPad, and a desktop width. Playwright from `apps/api/node_modules` if he is not at the machine (memory: `playwright-browser-verification`). One signed order, office account:

1. `Ispravi zatečeno stanje` from the **Fotografije** tab → lands on Pregled with the bar open (this is the case that renders nothing without the explicit navigation).
2. Tab strip inert; advance, remove and the status strip all unavailable.
3. Change all four: phone, a checklist row (including a second tap back to untouched), the fuel by ±, the equipment note. Add a marker, remove another one.
4. `Otkaži` → every value back to what it was, no request sent.
5. Repeat, then `Sačuvaj` → one dialog, one request, one toast.
6. The stamp on all four surfaces: header badge, the note beside the signatures, the list marker, and the **Istorija** row — which is the only one that may name what changed.
7. A phone-only correction: the history says "Telefon vlasnika izmenjen posle potpisa"; the other three say only that the order was changed.
8. Save with nothing changed → no stamp, no history row (check the Istorija tab, not just the toast).
9. Fotografije: add a photo (confirm mentions the mark), delete one (confirm, then it is gone and stays gone after a reload).
10. Serviser account: no correction button, no `+`, and his own late photo still uploads.

- [ ] **Step 3: Check the page does not overflow**

At 1180, 820 and 430: `document.documentElement.scrollWidth === clientWidth` on the detail in both modes. ⚠️ "Nothing outside the viewport" is the wrong criterion for a horizontally scrollable container — measure the page, and measure each control that joins segments (the type picker, the fuel stepper) for clipping *inside* itself. That is exactly how the status filter's last segment hid for three passes.

- [ ] **Step 4: Compare against the printed instruction**

`docs/25` §9.2 asks that every divergence from `Uputstvo Prijem Vozila.dc.html` be reported. The known and accepted ones are in the spec's §5 (six items). Report anything else to Nikola — do not fix it in this branch.

- [ ] **Step 5: Write the state down**

Append a block to `.superpowers/sdd/2026-07-29-intake-detail-v6/progress.md` in the established shape: what shipped, what each measurement found, what is left (V-7 print, still unspecified, and its premise still rejected). Update `docs/25` if anything in Steps 2–4 contradicts it.

- [ ] **Step 6: Full gate, commit, push**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add docs .superpowers
git commit -m "docs(intake): the edit mode is measured, and the log says what the measuring found"
git push origin feat/vehicle-intake
```

⚠️ Push only if the gate is green with `--force` (turbo's local cache has masked CI failures before) and nothing above is left half-built. If any step found something unresolved, stop and report it instead.

---

## Known limits, accepted deliberately

- **Leaving the page discards the buffer silently.** No `beforeunload` guard: the mode is re-enterable and holds at most four small edits. Not built, not forgotten.
- **Two operators editing one order at once:** the last save wins, both get a stamp and a history row. The per-field diff narrows the collision to the same field. Not a workflow that exists.
- **The serviser sees the stamp only after a refresh** — SSE does not reach his role (decision ③).
- **The "not every photo arrived" note stays forever on a permanently lost photo** (decision ⑧). `+` deliberately does not clear it: the office's photo is a new one, and the server raises the expectation with it.
