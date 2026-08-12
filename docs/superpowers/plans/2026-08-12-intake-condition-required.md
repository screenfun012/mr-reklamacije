# Zatečeno stanje je obavezno — plan gradnje

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-08-12-intake-condition-required-design.md` (`fdf462b`)

**Goal:** An intake order cannot be signed while the recorded condition says nothing — at least one checklist item answered DA/NE, or the equipment note written — and that note now reaches the printed sheet the owner signs.

**Architecture:** One pure predicate in `@mr/shared` is the whole rule; the wizard and the API service both call it, so the two can never drift. The wizard kills DALJE on the checklist step, the service refuses `sign()` with a 422, and the print sheet gains the equipment note under the checklist grid. No migration, no new permission, no schema change.

**Tech Stack:** TypeScript (strict), Zod, Drizzle, Hono, React 19 / TanStack Start, Vitest, Paraglide (sr/en).

## Global Constraints

- **No semicolons, single quotes, 2-space indent, trailing commas** — Prettier is in CI.
- **`any` is banned**, `!` non-null is banned, explicit return types on every exported function.
- **Named exports** (default only for React components / route files). Absolute imports (`@mr/*`, `~/`) — never `../../../`.
- **Every user-facing string goes through Paraglide `m.*`**, key style `namespace_context_variant`, and **both `sr.json` and `en.json` must gain it** (CI checks parity). Serbian is primary, informal "ti".
- **NO ICU plurals** — `{count, plural, …}` crashes this repo's Paraglide compile. Phrase counts so no grammatical form depends on the number.
- **After editing `packages/i18n/src/messages/*.json` run `pnpm --filter @mr/i18n run compile`** or the screen keeps showing the old text and it looks like the edit did not apply.
- **Comment WHY, not what.** No dead or commented-out code. Typed domain errors (`ValidationError`, …), never bare `Error`.
- **Layer law:** controller never touches DB; service/repository never import `hono` or HTTP types.
- **A green test proves nothing until you break the line it covers.** Every task's last verification step is a deliberate mutation.
- The full gate, run with `--concurrency=2` because Nikola's `pnpm dev:all` owns the machine:

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=2 \
  && pnpm --filter api depcruise && pnpm test:integration
```

- **Never start or kill the dev servers.** Use one-off commands that exit.

---

### Task 1: The rule — one predicate in `@mr/shared`

**Files:**

- Create: `packages/shared/src/utils/intake-condition-recorded.ts`
- Create: `packages/shared/src/utils/__tests__/intake-condition-recorded.test.ts`
- Modify: `packages/shared/src/index.ts` (add the export beside `computeDomaceTotal` on line 27)

**Interfaces:**

- Consumes: `IntakeChecklist` from `packages/shared/src/schemas/intake-order.schema.ts` — the type is `Record<string, boolean | null>`; `null` means "nobody touched this row", which is a value, not an absence.
- Produces: `isIntakeConditionRecorded(checklist: IntakeChecklist, equipmentNote: string | null, activeCatalogItemCount: number): boolean` — used by Task 2 (wizard) and Task 3 (API service).

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/utils/__tests__/intake-condition-recorded.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { isIntakeConditionRecorded } from '../intake-condition-recorded.js'

describe('isIntakeConditionRecorded', () => {
  it('passes when the catalog has nothing to fill, so an office mistake never stops a handover', () => {
    // Nikola's decision (spec §3): if the shop turned every item off, the car is still in the yard
    // and the serviser has no way to fix a catalog. The paper carries the empty-catalog sentence
    // as proof instead.
    expect(isIntakeConditionRecorded({}, null, 0)).toBe(true)
    expect(isIntakeConditionRecorded({ rezervna: null }, null, 0)).toBe(true)
  })

  it('refuses a checklist nobody touched', () => {
    // The exact shape a fresh order carries: every catalog code seeded as null.
    expect(isIntakeConditionRecorded({ rezervna: null, dizalica: null }, null, 2)).toBe(false)
    expect(isIntakeConditionRecorded({}, null, 2)).toBe(false)
    expect(isIntakeConditionRecorded({ rezervna: null }, '', 2)).toBe(false)
  })

  it('accepts a single answer, DA or NE alike', () => {
    // NE is a statement too — "there was no jack in this car" is exactly what the paper is for.
    expect(isIntakeConditionRecorded({ rezervna: true, dizalica: null }, null, 2)).toBe(true)
    expect(isIntakeConditionRecorded({ rezervna: false, dizalica: null }, null, 2)).toBe(true)
  })

  it('accepts the equipment note on its own', () => {
    expect(isIntakeConditionRecorded({ rezervna: null }, 'Gepek pun alata', 1)).toBe(true)
  })

  it('does not accept a note of pure whitespace, which prints as nothing', () => {
    expect(isIntakeConditionRecorded({ rezervna: null }, '   \n ', 1)).toBe(false)
  })

  it('counts an answer on an item the shop has since retired', () => {
    // The order still prints that row under its own name (commit ecd3ab3), so the paper asserts
    // something and the rule is met — even though the code is no longer in the active catalog.
    expect(isIntakeConditionRecorded({ ugaseno: true }, null, 3)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @mr/shared test -- intake-condition-recorded`
Expected: FAIL — cannot resolve `../intake-condition-recorded.js`.

- [ ] **Step 3: Write the predicate**

Create `packages/shared/src/utils/intake-condition-recorded.ts`:

```ts
import type { IntakeChecklist } from '../schemas/intake-order.schema.js'

/**
 * Did the intake record anything at all about the vehicle's condition?
 *
 * The owner signs the printed sheet while standing there, and that sheet is the only evidence if he
 * later says a jack was in the boot — so a signature over a band that asserts nothing is the thing
 * this rule exists to prevent (spec 2026-08-12 §1). The bar is deliberately low: one tap or one
 * written line, because a serviser who cannot get past a screen learns to stop filling it in.
 *
 * An answer on a code the shop has since retired counts: the order still prints that row under its
 * own name, so the paper asserts something.
 *
 * Shared by the wizard (which kills DALJE) and the API service (which refuses to sign), kept here so
 * the two can never drift.
 */
export function isIntakeConditionRecorded(
  checklist: IntakeChecklist,
  equipmentNote: string | null,
  activeCatalogItemCount: number,
): boolean {
  // Nothing to fill in — an empty catalog is the office's mistake, and it must not strand a car in
  // the yard. The sheet says so in words instead.
  if (activeCatalogItemCount === 0) {
    return true
  }
  if (equipmentNote !== null && equipmentNote.trim().length > 0) {
    return true
  }
  return Object.values(checklist).some((value) => value === true || value === false)
}
```

- [ ] **Step 4: Export it**

In `packages/shared/src/index.ts`, directly under the `computeDomaceTotal` export (line 27):

```ts
export { isIntakeConditionRecorded } from './utils/intake-condition-recorded.js'
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `pnpm --filter @mr/shared test -- intake-condition-recorded && pnpm --filter @mr/shared typecheck`
Expected: 6 passing, typecheck clean.

- [ ] **Step 6: Prove the tests bite (mutation)**

Change `activeCatalogItemCount === 0` to `activeCatalogItemCount < 0` and re-run: the empty-catalog test must go red. Then change `.some(...)` to `.every(...)` and re-run: the single-answer test must go red. **Revert both edits** and confirm green again.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/utils/intake-condition-recorded.ts \
        packages/shared/src/utils/__tests__/intake-condition-recorded.test.ts \
        packages/shared/src/index.ts
git commit -m "feat(shared): one predicate decides whether an intake recorded any condition at all"
```

---

### Task 2: The screen — DALJE is dead on the checklist step

**Files:**

- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-wizard.tsx` (`forwardDisabled` at :351, `hint` builder at :407)
- Modify: `packages/i18n/src/messages/sr.json`, `packages/i18n/src/messages/en.json`
- Create: `apps/internal-web/src/features/intake-orders/wizard/__tests__/intake-wizard-condition-gate.test.tsx`

**Interfaces:**

- Consumes: `isIntakeConditionRecorded` from `@mr/shared` (Task 1). The wizard already holds both inputs — `values.checklist`, `values.equipmentNote`, and `checklistItems` (loaded with `activeOnly: true` at :216).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Add the message to both locales**

In `packages/i18n/src/messages/sr.json`, next to the other `intake_hint_*` keys:

```json
"intake_hint_condition_empty": "Označi bar jednu stavku ili upiši napomenu — vlasnik potpisuje ovaj papir."
```

In `packages/i18n/src/messages/en.json`:

```json
"intake_hint_condition_empty": "Tick at least one item or write a note — the owner signs this sheet."
```

Then compile, or the screen keeps showing the old set:

```bash
pnpm --filter @mr/i18n run compile
```

- [ ] **Step 2: Write the failing test**

Create `apps/internal-web/src/features/intake-orders/wizard/__tests__/intake-wizard-condition-gate.test.tsx`. It opens the wizard straight onto step 2 through the draft buffer — the same door `intake-wizard-draft-offer.test.tsx` uses — because reaching step 2 by typing through step 1 would test step 1 instead.

```tsx
import { m, setLocale } from '@mr/i18n'
import type { IntakeChecklistItemListItem } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { navigateMock, toastMock, SERVISER_EMAIL } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
  SERVISER_EMAIL: 'marko@mrgroup.rs',
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('~/lib/use-internal-auth-user', () => ({
  useInternalAuthUser: () => ({ userName: 'Marko Marković', userEmail: SERVISER_EMAIL }),
}))
vi.mock('~/lib/internal-toast', () => ({ showInternalToast: toastMock }))
vi.mock('~/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'user-1' } } }) },
}))

import { IntakeWizard } from '../intake-wizard.js'
import {
  emptyIntakeWizardValues,
  writeIntakeDraft,
  type IntakeWizardValues,
} from '../intake-wizard-state.js'

const CATALOG: IntakeChecklistItemListItem[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'rezervna',
    nameSr: 'Rezervna guma',
    nameEn: 'Spare tyre',
    sortOrder: 10,
    isActive: true,
  },
]

/** Step 1 filled in, so the buffer can drop the wizard on step 2 without typing through it. */
function step2Values(overrides: Partial<IntakeWizardValues> = {}): IntakeWizardValues {
  return {
    ...emptyIntakeWizardValues(),
    orderNumber: 'RN-0249/26',
    plate: 'BG 774-LN',
    vehicle: 'Renault Master',
    ownerName: 'Milan Petrović',
    ownerPhone: '+381 60 111 2233',
    ...overrides,
  }
}

/** `fetchAllReferencePages` walks `{items, nextCursor}` pages — a null cursor ends the walk. */
function stubCatalog(items: IntakeChecklistItemListItem[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input)
      const body = url.includes('/api/intake-checklist-items') ? { items, nextCursor: null } : {}
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
}

async function openOnStep2(values: IntakeWizardValues): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup()
  writeIntakeDraft({ orderId: null, step: 2, values, savedBy: SERVISER_EMAIL })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <IntakeWizard />
    </QueryClientProvider>,
  )
  await user.click(await screen.findByRole('button', { name: m.intake_draft_resume() }))
  return user
}

function nextButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: m.intake_action_next() }) as HTMLButtonElement
}

describe('the wizard will not leave the checklist step with nothing recorded', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('holds DALJE and says why while nothing is recorded', async () => {
    stubCatalog(CATALOG)
    await openOnStep2(step2Values())

    await waitFor(() => expect(nextButton().disabled).toBe(true))
    expect(screen.getByText(m.intake_hint_condition_empty())).toBeInTheDocument()
  })

  it('releases DALJE on the first answer', async () => {
    stubCatalog(CATALOG)
    const user = await openOnStep2(step2Values())
    await waitFor(() => expect(nextButton().disabled).toBe(true))

    // NE is an answer, not a blank — the whole point of the third state.
    await user.click(await screen.findByRole('button', { name: m.intake_checklist_no() }))

    await waitFor(() => expect(nextButton().disabled).toBe(false))
  })

  it('releases DALJE on the equipment note alone', async () => {
    stubCatalog(CATALOG)
    const user = await openOnStep2(step2Values())
    await waitFor(() => expect(nextButton().disabled).toBe(true))

    await user.type(screen.getByLabelText(m.intake_field_equipment_note()), 'Gepek pun alata')

    await waitFor(() => expect(nextButton().disabled).toBe(false))
  })

  it('never holds DALJE when the catalog is empty', async () => {
    // The office turned everything off; the car is still in the yard.
    stubCatalog([])
    await openOnStep2(step2Values())

    await waitFor(() => expect(nextButton().disabled).toBe(false))
  })
})
```

⚠ One thing in that test must be checked against the code before running, and corrected in the test if it differs — do NOT change the component to match the test: the draft's `orderId` shape (`null` vs absent) and the resume-button label, both readable from `intake-wizard-state.ts` and `intake-wizard-draft-offer.test.tsx`. (`m.intake_checklist_yes()` / `m.intake_checklist_no()` are already verified against `intake-checklist-grid.tsx:64,79`.)

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter internal-web test -- intake-wizard-condition-gate`
Expected: FAIL — DALJE is enabled with nothing recorded (the gate does not exist yet).

- [ ] **Step 4: Wire the gate**

In `apps/internal-web/src/features/intake-orders/wizard/intake-wizard.tsx`, add `isIntakeConditionRecorded` to the existing `@mr/shared` import, then beside `canLeaveStep1` (:350):

```ts
/**
 * The condition is what the owner signs for, and it is filled in while he is standing there —
 * so it cannot be left for later (spec 2026-08-12 §4.1). The server holds the same line at
 * signing; this is the half that tells the serviser in time.
 */
const conditionRecorded = isIntakeConditionRecorded(
  values.checklist,
  values.equipmentNote,
  checklistItems.length,
)
```

Extend `forwardDisabled` (:351):

```ts
const forwardDisabled =
  saving ||
  numberTaken ||
  (step === INTAKE_WIZARD_STEPS.Vehicle && !canLeaveStep1) ||
  (step === INTAKE_WIZARD_STEPS.Checklist && !conditionRecorded)
```

- [ ] **Step 5: Make the footer say why**

In the `hint` builder (:407), add a branch **before** the `if (step !== 1)` fall-through and **after** the `numberTaken` branch, so a taken number still wins:

```ts
if (step === INTAKE_WIZARD_STEPS.Checklist && !conditionRecorded) {
  return { text: m.intake_hint_condition_empty(), tone: 'warn' }
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter internal-web test -- intake-wizard-condition-gate step-checklist`
Expected: PASS, and `step-checklist.test.tsx` still green.

- [ ] **Step 7: Prove the tests bite (mutation)**

Delete the `step === INTAKE_WIZARD_STEPS.Checklist && !conditionRecorded` clause from `forwardDisabled` and re-run: the first two tests must go red. **Revert** and confirm green.

- [ ] **Step 8: Commit**

```bash
git add apps/internal-web/src/features/intake-orders/wizard/intake-wizard.tsx \
        apps/internal-web/src/features/intake-orders/wizard/__tests__/intake-wizard-condition-gate.test.tsx \
        packages/i18n/src/messages/sr.json packages/i18n/src/messages/en.json
git commit -m "feat(intake): the wizard will not leave the checklist step with nothing recorded"
```

---

### Task 3: The server — the same line at signing

**Files:**

- Modify: `apps/api/src/core/ports/intake-checklist-catalog-port.ts`
- Modify: `apps/api/src/modules/intake-checklist-items/intake-checklist-items.repository.ts` (beside `listKnownCodes` at :97)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts` (`sign()` at :417)
- Modify: `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`

**Interfaces:**

- Consumes: `isIntakeConditionRecorded` from `@mr/shared` (Task 1).
- Produces: `IntakeChecklistCatalogPort.countActiveItems(): Promise<number>` — a second method on the existing port, implemented by `IntakeChecklistItemsRepository`.

⚠ **Read this before writing code.** The port's existing `listKnownCodes()` deliberately returns **every code the catalog ever held, retired and soft-deleted included** — using it here would count a fully-retired catalog as full and lock the shop floor, which is exactly what Nikola refused. The new method is a separate, filtered count.

⚠ **The checklist catalog is a SYSTEM seed** (`packages/db/src/seed/intake-catalogs.ts`, run by `runSystemSeeds`), so the test database and production both have active items. This gate therefore bites in the existing suite: `signedOrder()` (:102), `signedOrderExpecting()` (:121) and the direct `service.sign(` at :500 all sign orders whose checklist is `{}`. They must record something first, or every test built on them fails.

- [ ] **Step 1: Write the failing integration tests**

In `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`, add a new `describe` beside the existing `'the checklist is judged against the catalog'` block:

```ts
describe('an order cannot be signed with nothing recorded about its condition', () => {
  const SIGNATURES = {
    technicianSignature: 'M 0 0 L 10 10',
    ownerSignature: 'M 5 5 L 20 20',
    photosExpected: 0,
  }

  it('refuses the signature while the checklist and the note are both empty', async () => {
    const serviser = await floorActor()
    const created = await service.create(createInput(), actorContext(serviser.id))

    await expect(
      service.sign(created.id, SIGNATURES, serviser, actorContext(serviser.id)),
    ).rejects.toBeInstanceOf(ValidationError)

    // Refused means refused: the order is still a draft the serviser can go back and finish.
    const after = await service.findById(created.id, serviser)
    expect(after.signedAt).toBeNull()
  })

  it('accepts the signature once a single item is answered', async () => {
    const serviser = await floorActor()
    const created = await service.create(createInput(), actorContext(serviser.id))
    await service.update(
      created.id,
      { checklist: { rezervna: false } },
      serviser,
      actorContext(serviser.id),
    )

    const signed = await service.sign(created.id, SIGNATURES, serviser, actorContext(serviser.id))

    expect(signed.signedAt).not.toBeNull()
  })

  it('accepts the signature on the equipment note alone', async () => {
    const serviser = await floorActor()
    const created = await service.create(createInput(), actorContext(serviser.id))
    await service.update(
      created.id,
      { equipmentNote: 'Gepek pun alata' },
      serviser,
      actorContext(serviser.id),
    )

    const signed = await service.sign(created.id, SIGNATURES, serviser, actorContext(serviser.id))

    expect(signed.signedAt).not.toBeNull()
  })
})

describe('countActiveItems', () => {
  it('counts only what a serviser can actually tick', async () => {
    const admin = await createUser('Admin')
    const before = await container.intakeChecklistItemsRepository.countActiveItems()

    const added = await checklistService.create(
      { code: 'privremena', nameSr: 'Privremena', nameEn: 'Temporary', sortOrder: 900 },
      actorContext(admin),
    )
    expect(await container.intakeChecklistItemsRepository.countActiveItems()).toBe(before + 1)

    // Retired and removed items still answer `listKnownCodes` on purpose — they must NOT answer
    // here, or a fully retired catalog would read as full and lock the shop floor.
    await checklistService.update(added.id, { isActive: false }, actorContext(admin))
    expect(await container.intakeChecklistItemsRepository.countActiveItems()).toBe(before)
  })
})
```

`container.intakeChecklistItemsRepository` is already exposed (`core/container.ts:124`), so that reach is real. ⚠ Two things still to check against the file before running, adjusting the test and not the production code if they differ: whether `ValidationError` is already imported here, and the exact `checklistService.create` input shape — read the `'accepts a checklist key the admin added to the catalog'` test at :613.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter api test:integration -- intake-orders`
Expected: the three sign tests FAIL (the signature is accepted), and `countActiveItems` FAILS as not a function.

- [ ] **Step 3: Add the count to the port and the repository**

In `apps/api/src/core/ports/intake-checklist-catalog-port.ts`, inside the interface:

```ts
/**
 * How many items a serviser can actually tick right now — active, not soft-deleted.
 *
 * Deliberately NOT `listKnownCodes().length`: that read keeps retired codes on purpose, so a shop
 * that turned every item off would still look full and the signing guard would lock the floor over
 * a mistake nobody on the floor can fix.
 */
countActiveItems(): Promise<number>
```

In `apps/api/src/modules/intake-checklist-items/intake-checklist-items.repository.ts`, beside `listKnownCodes`:

```ts
async countActiveItems(): Promise<number> {
  const [row] = await this.db
    .select({ count: count() })
    .from(intakeChecklistItems)
    .where(and(eq(intakeChecklistItems.isActive, true), isNull(intakeChecklistItems.deletedAt)))

  return row?.count ?? 0
}
```

Add `count` to the existing `drizzle-orm` import if it is not there.

- [ ] **Step 4: Gate `sign()`**

In `apps/api/src/modules/intake-orders/intake-orders.service.ts`, add `isIntakeConditionRecorded` to the `@mr/shared` import, then inside `sign()` after the already-signed check and **before** `this.repo.sign`:

```ts
/**
 * The screen holds this line too, but a tablet reloads and `?resume=` is a URL — the paper the
 * owner signs must not depend on which browser produced it (spec 2026-08-12 §4.2).
 */
const activeItems = await this.checklistCatalog.countActiveItems()
if (!isIntakeConditionRecorded(before.checklist, before.equipmentNote, activeItems)) {
  throw new ValidationError('Intake order: the recorded condition is empty')
}
```

- [ ] **Step 5: Repair the existing helpers this gate now blocks**

In the same test file, give the two helpers something to record. In `signedOrder()` (:102) and `signedOrderExpecting()` (:121), between `service.create(...)` and `service.sign(...)`:

```ts
// Signing now needs a recorded condition (spec 2026-08-12), and these helpers stand in for a
// finished intake — one answered item is what the serviser would have tapped.
await service.update(
  created.id,
  { checklist: { rezervna: true } },
  actor,
  actorContext(actor.id),
)
```

Do the same for the direct `service.sign(` at :500 — read its surrounding test first and add the update to whatever order it signs, keeping that test's own intent untouched.

- [ ] **Step 6: Run the whole intake suite**

Run: `pnpm --filter api test:integration -- intake-orders`
Expected: all green, including every test that was already there.

- [ ] **Step 7: Prove the tests bite (mutation)**

Replace `countActiveItems()` in `sign()` with `(await this.checklistCatalog.listKnownCodes()).length` — the tests must stay green (both are non-zero here), which is precisely why the next mutation matters: now make `countActiveItems` return `0` unconditionally and re-run — the refusal test must go red. Then revert and delete the `throw` — the refusal test must go red again. **Revert everything** and confirm green.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/core/ports/intake-checklist-catalog-port.ts \
        apps/api/src/modules/intake-checklist-items/intake-checklist-items.repository.ts \
        apps/api/src/modules/intake-orders/intake-orders.service.ts \
        apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts
git commit -m "feat(api): an intake cannot be signed while nothing about its condition is recorded"
```

---

### Task 4: The paper — the note the rule now accepts must be printed

**Files:**

- Modify: `apps/internal-web/src/features/intake-orders/print/intake-print-data.ts` (`IntakePrintModel` at :64, the mapping at :143)
- Modify: `apps/internal-web/src/features/intake-orders/print/intake-print-condition.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-data.test.ts`
- Modify: `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-sheet.test.tsx`

**Interfaces:**

- Consumes: `IntakePrintModel` gains `equipmentNote: string | null`.
- Produces: nothing for later tasks.

**Why this is not cosmetic:** Task 1 lets the equipment note satisfy the rule on its own. The note does not reach the sheet today — it lives only on the detail screen (`detail/card-condition.tsx:95`). Without this task a serviser can satisfy the screen and still hand the owner a document that asserts nothing, which is the exact failure the rule was written against.

- [ ] **Step 1: Write the failing tests**

In `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-data.test.ts`, add to the existing describe:

```ts
it('carries the equipment note onto the sheet, clipped like the remarks', () => {
  const model = buildIntakePrintModel(
    { ...orderFixture(), equipmentNote: 'Gepek pun alata' },
    catalogFixture(),
    'sr',
  )

  expect(model.equipmentNote).toBe('Gepek pun alata')
})

it('keeps an empty note out of the model rather than printing a blank line', () => {
  const model = buildIntakePrintModel(
    { ...orderFixture(), equipmentNote: '   ' },
    catalogFixture(),
    'sr',
  )

  expect(model.equipmentNote).toBeNull()
})
```

In `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-sheet.test.tsx`:

```tsx
it('prints the equipment note inside the condition band', () => {
  renderSheet({ ...orderFixture(), equipmentNote: 'Gepek pun alata' })

  expect(screen.getByText('Gepek pun alata')).toBeInTheDocument()
})

it('says the checklist is unfilled only when there is neither a row nor a note', () => {
  // Reachable only when the catalog was empty at intake — since 2026-08-12 that is the one way an
  // order reaches paper with nothing ticked, so the sentence is a net for somebody else's mistake,
  // not a normal outcome.
  renderSheet({ ...orderFixture(), checklist: {}, equipmentNote: null }, [])
  expect(screen.getByText(m.intake_print_condition_empty())).toBeInTheDocument()

  cleanup()

  renderSheet({ ...orderFixture(), checklist: {}, equipmentNote: 'Gepek pun alata' }, [])
  expect(screen.queryByText(m.intake_print_condition_empty())).toBeNull()
})
```

⚠ Match the fixture and render helper names already used in each file (`orderFixture`, `catalogFixture`, `renderSheet`, and whether the sheet helper takes a catalog argument) — read the top of each test file first and adapt these bodies to what is there. Import `cleanup` from `@testing-library/react` if the second test needs it and it is not imported.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter internal-web test -- intake-print-data intake-print-sheet`
Expected: FAIL — `model.equipmentNote` does not exist, the note is nowhere on the sheet.

- [ ] **Step 3: Put the note in the model**

In `intake-print-data.ts`, add to the `IntakePrintModel` interface beside `ownerRemarks` (:68):

```ts
/** Null when the serviser wrote nothing — the band then shows only its rows. */
equipmentNote: string | null
```

And in the mapping (:143 area), reusing the clipper that already exists rather than writing a second one:

```ts
equipmentNote: clipEquipmentNote(order.equipmentNote),
```

with, beside `clipRemarks` (:98):

```ts
/**
 * Same length ceiling as the remarks, but empty stays EMPTY rather than becoming a placeholder: an
 * absent note prints nothing at all, while "no remarks" is a statement the remarks box has to make.
 */
function clipEquipmentNote(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length <= PRINT_MAX_REMARKS ? trimmed : `${trimmed.slice(0, PRINT_MAX_REMARKS)}…`
}
```

- [ ] **Step 4: Print it, and narrow the empty sentence**

In `intake-print-condition.tsx`, change the empty-band condition so the sentence only appears when there is genuinely nothing, and render the note under the grid:

```tsx
{model.checklist.length === 0 && model.equipmentNote === null ? (
  <div className="mt-[9px] text-[11.5px] text-[#54555b]">
    {m.intake_print_condition_empty({}, { locale })}
  </div>
) : (
  <div className="mt-[9px] grid grid-cols-4 gap-x-5 gap-y-[6px] text-[11.5px]">
    {/* unchanged rows */}
  </div>
)}

{model.equipmentNote === null ? null : (
  <div className="mt-[7px] text-[11.5px] leading-[1.5] text-[#54555b]">{model.equipmentNote}</div>
)}
```

Update the component's leading comment: the band's absence sentence is now the empty-catalog case only.

- [ ] **Step 5: Run the print suite**

Run: `pnpm --filter internal-web test -- intake-print`
Expected: the whole print module green (81 tests before this task; expect more now).

- [ ] **Step 6: Prove the tests bite (mutation)**

Delete the note `<div>` from `intake-print-condition.tsx` and re-run: the sheet test must go red. Then restore it and change `clipEquipmentNote`'s empty branch to return `''` instead of `null`: the empty-sentence test must go red. **Revert both** and confirm green.

- [ ] **Step 7: Commit**

```bash
git add apps/internal-web/src/features/intake-orders/print/
git commit -m "fix(intake): the equipment note reaches the paper the owner signs, not just the screen"
```

---

### Task 5: The print preview's zoom button

**Not part of the condition rule.** It is the already-decided half of the uncommitted zoom work sitting in the tree, and it must land in the same push so the instruction sentence it replaces never enters history as live. Nikola decided this on 2026-08-12: *"reši kako god misliš, samo da ne izgleda kao AI slop"*, and he cannot pinch with a mouse, so a gesture-only affordance is unreachable for him.

**Files:**

- Modify: `apps/internal-web/src/features/intake-orders/print/use-intake-print-zoom.ts` (the return at :248)
- Modify: `apps/internal-web/src/features/intake-orders/print/intake-print-dialog.tsx` (the hint at :110-112, toolbar `<div>` at :101)
- Modify: `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-dialog.test.tsx` (the test at :497)
- Modify: `packages/i18n/src/messages/sr.json`, `packages/i18n/src/messages/en.json` — **delete** `intake_print_zoom_hint`, **add** two keys

**Interfaces:**

- Consumes: `intakeDoubleTapScale(scale: number, fitScale: number): number` from `./intake-print-zoom.js` — already written and already tested; the button must call it and must not compute a scale of its own.
- Produces: `useIntakePrintZoom(...)` gains a third returned member, `toggle: () => void`, beside the existing `{ scale, handlers }`.

- [ ] **Step 1: Swap the messages**

Delete `"intake_print_zoom_hint"` from both `sr.json` and `en.json`, and add:

```json
"intake_print_zoom_actual": "Prava veličina",
"intake_print_zoom_whole": "Cela strana"
```

```json
"intake_print_zoom_actual": "Actual size",
"intake_print_zoom_whole": "Whole page"
```

Then: `pnpm --filter @mr/i18n run compile`

- [ ] **Step 2: Rewrite the hint test as a button test**

There is exactly one test on the retired sentence — `'names the gesture where there is one, and stays quiet on a desktop'` (:497). Replace it, keeping its setup verbatim (`firstResizeObserverCallback`, `renderDetailUi(<ClosedThenOpen />)`, `PHONE`, `scaleOf`, all already in this file):

```tsx
it('offers the reading size where the paper does not fit, and stays quiet on a desktop', async () => {
  const resizeTo = firstResizeObserverCallback()
  await renderDetailUi(<ClosedThenOpen />)
  fireEvent.click(screen.getByRole('button', { name: 'open' }))

  resizeTo(PHONE)
  expect(screen.getByRole('button', { name: m.intake_print_zoom_actual() })).toBeDefined()

  // A desktop draws the paper at 1:1 already: both ends of the toggle are the same size, so there
  // is nothing to offer and a button that changes nothing reads as broken.
  resizeTo(1400)
  expect(screen.queryByRole('button', { name: m.intake_print_zoom_actual() })).toBeNull()
  expect(screen.queryByRole('button', { name: m.intake_print_zoom_whole() })).toBeNull()
})

it('the button toggles, and its label always names where the next press goes', async () => {
  const resizeTo = firstResizeObserverCallback()
  await renderDetailUi(<ClosedThenOpen />)
  fireEvent.click(screen.getByRole('button', { name: 'open' }))
  resizeTo(PHONE)

  fireEvent.click(screen.getByRole('button', { name: m.intake_print_zoom_actual() }))

  // One press and the offer reverses — the label is the destination, never the gesture.
  expect(screen.getByRole('button', { name: m.intake_print_zoom_whole() })).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: m.intake_print_zoom_whole() }))
  expect(screen.getByRole('button', { name: m.intake_print_zoom_actual() })).toBeDefined()
})
```

⚠ The second test asserts the label round-trip rather than a number, because the scale the button writes is `intakeDoubleTapScale`'s output and that function already has its own tests in `intake-print-zoom.test.ts`. If this file's `scaleOf(scaler)` is convenient, pin the scale too — but never re-derive the expected number by hand here.

- [ ] **Step 3: Run and watch it fail**

Run: `pnpm --filter internal-web test -- intake-print-dialog`
Expected: FAIL — no such button.

- [ ] **Step 4: Give the hook a press-sized door**

The hook exposes `{ scale, handlers }` and nothing that sets the scale: `zoomTo` is private and needs a focal point and an element, both of which only a finger has. Add one line beside it in `use-intake-print-zoom.ts` and return it:

```ts
/**
 * The same toggle a double tap performs, for a press that has no focal point. Deliberately without
 * an anchor: the effect only re-anchors when a gesture stored one, so the scroll simply stays where
 * it is — which from a fitted page is the top-left, i.e. the start of the document being read.
 */
const toggle = (): void => setUserScale(intakeDoubleTapScale(scale, fitScale))
```

```ts
return {
  scale,
  toggle,
  handlers: {
    // …unchanged
  },
}
```

- [ ] **Step 5: Replace the sentence with the button**

In `intake-print-dialog.tsx`, take `toggle` from the hook at :58, delete the `{fitScale < 1 ? <span>…</span> : null}` block at :110-112, and put the button in its place — same slot in the toolbar, after the title and before the `ml-auto` locale group. The class list is copied from the "Zatvori" button (:136) so it is visibly the same control:

```tsx
{/* Only where there is something to zoom: on a desktop the paper is already at 1:1 and both ends
    of the toggle are the same size. The label names WHERE THE PRESS GOES, never the gesture — the
    workers are not computer literate, and the owner cannot pinch with a mouse at all. */}
{fitScale < 1 ? (
  <button
    type="button"
    onClick={toggle}
    className="min-h-11 cursor-pointer rounded-[9px] border border-white/25 bg-white/10 px-5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-white"
  >
    {scale > fitScale ? m.intake_print_zoom_whole() : m.intake_print_zoom_actual()}
  </button>
) : null}
```

- [ ] **Step 6: Run the print suite**

Run: `pnpm --filter internal-web test -- intake-print`
Expected: green — the whole module, including the gesture tests written on 2026-08-11.

- [ ] **Step 7: Confirm the retired key is gone everywhere**

```bash
grep -rn "intake_print_zoom_hint" apps packages || echo "clean"
```

Expected: `clean`.

- [ ] **Step 8: Commit — the whole zoom feature, in one commit**

The gesture work has been sitting uncommitted since 2026-08-11 and belongs with the button:

```bash
git add apps/internal-web/src/features/intake-orders/print/ \
        packages/i18n/src/messages/sr.json packages/i18n/src/messages/en.json
git commit -m "feat(intake): the print preview zooms, and a button offers it to anyone without a touchscreen"
```

---

### Task 6: The gate, and the push

- [ ] **Step 1: Confirm the tree holds only this work**

```bash
git status --short
```

Expected: clean. Anything else means a task committed too little — find it before going further.

- [ ] **Step 2: Run the full gate**

Nothing else may run at the same time — no second gate, no parallel agent. A busy machine starves timing-sensitive component tests and produces failures that are about the CPU, not the code.

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=2 \
  && pnpm --filter api depcruise && pnpm test:integration
```

Expected: exit 0, `Cached 0/58` (proof `--force` really skipped the cache).

- [ ] **Step 3: Check the i18n parity yourself**

```bash
node -e "const s=require('./packages/i18n/src/messages/sr.json'),e=require('./packages/i18n/src/messages/en.json');const ks=Object.keys(s),ke=Object.keys(e);console.log(ks.length,ke.length,ks.filter(k=>!ke.includes(k)),ke.filter(k=>!ks.includes(k)))"
```

Expected: equal counts, two empty arrays.

- [ ] **Step 4: Report to Nikola, in Serbian, and stop**

Say what was built, what the gate printed, and name the two things only his device can answer: whether the printed sheet still matches the old paper now that the note is on it, and whether the zoom button reads right on the tablet at 390–430px. **Do not push before he has been told the gate is green** — the branch carries 11 unpushed commits plus these, and the bar is the work, not permission.
