# Prijem — dva „+" (deo C), plan gradnje

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-08-11-intake-extra-items-c-design.md` (odobren po sekcijama, Nikola 11.08.)

**Goal:** A serviser can write down what the lists do not offer — an extra DA/NE equipment row, and a defect that has no place on the silhouette — so that what he sees on the car reaches the paper the owner signs.

**Architecture:** Two new jsonb columns on `intake_orders` (`extra_checklist`, `extra_damages`), deliberately not folded into the existing `checklist` (its codes are the admin's catalog) or `damages` (which would need an empty-value guard in five places). Everything else rides existing machinery: the signing freeze covers them by not listing them, the print sheet grows one sub-block, and no new permission, endpoint, SSE event or history transition exists.

**Tech Stack:** TypeScript (strict), Zod, Drizzle, Hono, React 19 / TanStack Start, Vitest, Paraglide (sr/en).

## Ispravke speca — provereno u kodu 12.08., spec je pisan na `bcce1d8`

| Spec kaže | Stvarno stanje | Posledica po plan |
|---|---|---|
| migracija **`0038`** | `0038`–`0040` su zauzete (deo H) | migracija je **`0041`** |
| `FREE_AFTER_SIGNING = ['services','materials']` | `['services','materials','contactPhone']` | isti zaključak — dve nove kolone su zamrznute time što nisu na spisku |
| brojač bi čitao `INTAKE_CHECKLIST_KEYS.length` bez G1 | **G1 je sagrađen**, brojač već čita katalog | ukupan broj = katalog + dopisane, kako spec i traži |
| §8: „Napomena uz opremu se ne štampa (⑲)" | **štampa se od 12.08.** (`4d5d517`) | ta prijava je **rešena**, briše se iz otvorenih |

⚠️ **Jedna stvar koju spec nije mogao da zna, i koja menja vidljivo ponašanje.** Od 12.08. nalog se ne sme potpisati dok o stanju nije zabeleženo bar nešto (CLAUDE.md §2). Taj propis (`isIntakeConditionRecorded`) danas gleda samo kataloške stavke i napomenu. Dopisana stavka odgovorena sa DA je **zabeležena stvar koja se štampa**, pa mora da otključa — inače radnik gleda popunjen red na ekranu dok mu podnožje tvrdi da ništa nije upisano, što je ekran koji laže radniku. **Zato Zadatak 2 proširuje propis dopisanim stavkama.** Bez toga bi deo C razbio pravilo iz dela pre njega.

## Global Constraints

- **No semicolons, single quotes, 2-space indent, trailing commas** — Prettier is in CI.
- **`any` banned**, `!` non-null banned, explicit return types on exported functions, no `enum` (use `as const`).
- **Every user string via Paraglide `m.*`**, in BOTH `sr.json` and `en.json` (CI checks parity), keys `namespace_context_variant`.
- **NO ICU plurals** — they crash this repo's Paraglide compile. Phrase counts so no grammatical form depends on the number.
- **After editing `packages/i18n/src/messages/*.json` run `pnpm --filter @mr/i18n run compile`**, or the screen keeps showing the old text.
- **`dist` lags `src`**: tests read `src`, typecheck reads `dist`. After changing `@mr/shared` or `@mr/i18n`, run `pnpm exec turbo run build --filter=@mr/shared --filter=@mr/i18n --concurrency=2` before typechecking an app.
- **Comment WHY, not what.** No dead code. Typed domain errors, never bare `Error`.
- **A green test proves nothing until you break the line it covers** — every task ends with a deliberate mutation, reverted byte-for-byte.
- Full gate, `--concurrency=2`, nothing else running:

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=2 \
  && pnpm --filter api depcruise && pnpm test:integration
```

- **Never start or kill the dev servers.** Browser proof goes through Playwright with a throwaway admin (see Task 5).

---

### Task 1 (C-0): The migration — ⚠️ NE POČINJATI BEZ NIKOLINE REČI

**Files:**
- Modify: `packages/db/src/schema/intake-orders.ts`
- Create: `packages/db/migrations/0041_*.sql` (**generated**, never hand-written)
- Modify: `packages/db/migrations/meta/_journal.json` (drizzle writes it)

**Interfaces:**
- Produces: `intakeOrders.extraChecklist` (`jsonb NOT NULL DEFAULT '[]'`) and `intakeOrders.extraDamages` (`jsonb NOT NULL DEFAULT '[]'`), typed through `@mr/db` from the shared schemas Task 2 defines.

- [ ] **Step 1: Add the columns to the Drizzle schema**

In `packages/db/src/schema/intake-orders.ts`, beside the existing `checklist` and `damages` jsonb columns:

```ts
/**
 * What the shop's lists do not offer. Deliberately NOT folded into `checklist`: that map is keyed by
 * the admin's catalog codes and the service refuses a code the catalog does not know, so a written-in
 * row would have to be given a code — and the moment it has one, the catalog has stopped being the
 * admin's (spec C §3.1).
 */
extraChecklist: jsonb('extra_checklist').$type<IntakeExtraChecklist>().notNull().default([]),
/**
 * Defects with no place on the silhouette — wheels, interior, exhaust. Not in `damages`, which needs
 * `x`, `y`, `zone` and `type`; letting those be empty would mean an empty-value guard in five places
 * (the drawing, the ①②③ numbering, the printed markers, photo linking, and the server's zone
 * re-derivation) against two columns here.
 */
extraDamages: jsonb('extra_damages').$type<IntakeExtraDamages>().notNull().default([]),
```

Import the two types from `@mr/shared` the way `checklist`/`damages` already do in this file — read the top of the file and follow it exactly.

- [ ] **Step 2: Generate the migration — never write the SQL**

```bash
pnpm --filter @mr/db run db:generate
```

- [ ] **Step 3: Read the generated SQL and confirm it is ONLY the intended DDL**

```bash
cat packages/db/migrations/0041_*.sql
```

Expected: two `ALTER TABLE "intake_orders" ADD COLUMN ... jsonb DEFAULT '[]'::jsonb NOT NULL` and nothing else. **If anything else appears — a dropped index, a changed constraint, a touched column — stop and report it.** Confirm the journal gained exactly one entry:

```bash
python3 -c "import json;print([e['tag'] for e in json.load(open('packages/db/migrations/meta/_journal.json'))['entries']][-3:])"
```

- [ ] **Step 4: Prove a clean migrate-from-zero on an empty database**

An empty DB needs the four extensions first (they are NOT in migrations): `uuid-ossp`, `pgcrypto`, `citext`, `pg_trgm`.

```bash
docker exec mr-reklamacije-postgres psql -U mr -d postgres -c 'DROP DATABASE IF EXISTS mr_migrate_probe;'
docker exec mr-reklamacije-postgres psql -U mr -d postgres -c 'CREATE DATABASE mr_migrate_probe;'
docker exec mr-reklamacije-postgres psql -U mr -d mr_migrate_probe -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pg_trgm;'
DATABASE_URL='postgresql://mr:mr_dev_password@localhost:5433/mr_migrate_probe' pnpm --filter @mr/db run db:migrate
docker exec mr-reklamacije-postgres psql -U mr -d mr_migrate_probe -tAc "select column_name, is_nullable, column_default from information_schema.columns where table_name='intake_orders' and column_name like 'extra_%';"
docker exec mr-reklamacije-postgres psql -U mr -d postgres -c 'DROP DATABASE mr_migrate_probe;'
```

Expected: 41 migrations apply with no error, and both columns come back `NO` / `'[]'::jsonb`.

- [ ] **Step 5: Apply to the dev database and confirm old rows are untouched**

```bash
pnpm --filter @mr/db run db:migrate
docker exec mr-reklamacije-postgres psql -U mr -d mr_reklamacije -tAc "select count(*) filter (where extra_checklist = '[]'::jsonb) as prazne, count(*) as ukupno from intake_orders;"
```

Expected: the two numbers are equal — every existing order got `[]`, nothing lost it.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/intake-orders.ts packages/db/migrations/
git commit -m "feat(db): an intake can carry the rows its lists do not offer"
```

---

### Task 2 (C-1a): The shapes, and the recording rule that has to know about them

**Files:**
- Modify: `packages/shared/src/schemas/intake-order.schema.ts` (add the two schemas; **delete the dead `note`** from `IntakeDamageSchema:65`)
- Modify: `packages/shared/src/schemas/intake-order.wire.schema.ts` (`:71-73` update input, `:267-269` read shape)
- Modify: `packages/shared/src/utils/intake-condition-recorded.ts`
- Modify: `packages/shared/src/utils/__tests__/intake-condition-recorded.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `IntakeExtraChecklistSchema` / `IntakeExtraChecklist` (`{name: string, value: boolean | null}[]`), `IntakeExtraDamagesSchema` / `IntakeExtraDamages` (`string[]`), and the widened `isIntakeConditionRecorded(checklist, extraChecklist, equipmentNote, activeCatalogItemCount): boolean`.

- [ ] **Step 1: Write the failing tests for the widened rule**

In `packages/shared/src/utils/__tests__/intake-condition-recorded.test.ts`, update every existing call to pass `[]` as the new second argument, then add:

```ts
it('accepts a written-in row the serviser answered, which prints like any other', () => {
  // The screen shows an answered row; a footer still saying "nothing is recorded" would be the
  // screen lying to the worker (CLAUDE.md §2 + spec C).
  expect(isIntakeConditionRecorded({ rezervna: null }, [{ name: 'Gumeni patosnici', value: true }], null, 2)).toBe(true)
  expect(isIntakeConditionRecorded({ rezervna: null }, [{ name: 'Gumeni patosnici', value: false }], null, 2)).toBe(true)
})

it('does not accept a written-in row nobody answered', () => {
  // Same third state as the catalog rows: added is not answered.
  expect(isIntakeConditionRecorded({ rezervna: null }, [{ name: 'Gumeni patosnici', value: null }], null, 2)).toBe(false)
})
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm --filter @mr/shared test -- intake-condition-recorded`
Expected: FAIL — too many arguments / the new cases return `false`.

- [ ] **Step 3: Add the two schemas and delete the dead field**

In `packages/shared/src/schemas/intake-order.schema.ts`, beside `IntakeChecklistSchema`:

```ts
/**
 * A row the serviser wrote in because the catalog does not offer it — same DA/NE/untouched as a
 * catalog row, but living on this order alone. 80 characters is what fits one line on the printed
 * sheet; there is no `id` per row on purpose, since nothing points at one (a photo links through a
 * damage marker, and after signing these lists cannot change at all).
 */
export const IntakeExtraChecklistItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  value: z.boolean().nullable(),
})
export const IntakeExtraChecklistSchema = z.array(IntakeExtraChecklistItemSchema).max(100)
export type IntakeExtraChecklist = z.infer<typeof IntakeExtraChecklistSchema>

/**
 * Defects with no place on the silhouette. A bare `string[]` because that is NOT a new shape in this
 * table — `services` and `materials` already are one, with the same two ceilings.
 */
export const IntakeExtraDamagesSchema = z.array(z.string().trim().min(1).max(200)).max(100)
export type IntakeExtraDamages = z.infer<typeof IntakeExtraDamagesSchema>
```

In the same file **delete line 65** — `note: z.string().trim().max(500).optional(),` from `IntakeDamageSchema`. It has been declared since V-4a and is never written, read or printed; `CLAUDE.md` §6 forbids dead code, and this is the schema C is already editing.

- [ ] **Step 4: Widen the wire schema**

In `packages/shared/src/schemas/intake-order.wire.schema.ts`, beside `checklist` in the update input (`:71`) and in the read shape (`:267`):

```ts
extraChecklist: IntakeExtraChecklistSchema.optional(),   // update input
extraDamages: IntakeExtraDamagesSchema.optional(),
```

```ts
extraChecklist: IntakeExtraChecklistSchema,              // read shape
extraDamages: IntakeExtraDamagesSchema,
```

- [ ] **Step 5: Widen the rule**

In `packages/shared/src/utils/intake-condition-recorded.ts`:

```ts
export function isIntakeConditionRecorded(
  checklist: IntakeChecklist,
  extraChecklist: IntakeExtraChecklist,
  equipmentNote: string | null,
  activeCatalogItemCount: number,
): boolean {
  // Nothing to fill in — an empty catalog is the office's mistake, and it must not strand a car in
  // the yard. A written-in row is still possible there, and still counts below.
  if (activeCatalogItemCount === 0) {
    return true
  }
  if (equipmentNote !== null && equipmentNote.trim().length > 0) {
    return true
  }
  const answered = (value: boolean | null): boolean => value === true || value === false
  // A written-in row counts exactly like a catalog one: it prints the same way, so it asserts the
  // same thing on the document the owner signs.
  return Object.values(checklist).some(answered) || extraChecklist.some((row) => answered(row.value))
}
```

Export the two new schemas and types from `packages/shared/src/index.ts` beside the existing intake exports.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @mr/shared test && pnpm --filter @mr/shared typecheck`
Expected: PASS (8 cases in this file), typecheck clean.

- [ ] **Step 7: Prove the tests bite (mutation)**

Drop `|| extraChecklist.some(...)` from the return and re-run: the written-in-row test must go red. Then change `answered(row.value)` to `true` and re-run: the untouched-row test must go red. **Revert both**, confirm green.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): the intake carries written-in rows, and the recording rule counts them"
```

---

### Task 3 (C-1b): The server — two columns, zero new guards

**Files:**
- Modify: `apps/api/src/modules/intake-orders/intake-orders.validators.ts` (re-exports the wire shapes)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.repository.ts` (select + insert + update)
- Modify: `apps/api/src/modules/intake-orders/intake-orders.service.ts` (the `sign()` call site of the rule)
- Modify: `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`

**Interfaces:**
- Consumes: the schemas and the widened predicate from Task 2.
- Produces: `IntakeOrderDetail` now carries `extraChecklist` and `extraDamages`.

⚠️ **No new guard is written here.** After part H the only whitelist is `FREE_AFTER_SIGNING = ['services', 'materials', 'contactPhone']`, and anything not on it is refused **by field name** after signing — so the two new columns are frozen simply by not being on that list. Do not add a second check; a duplicate freeze is the kind of patch that later disagrees with the original.

- [ ] **Step 1: Write the failing integration tests**

In `apps/api/src/modules/intake-orders/__tests__/intake-orders.integration.test.ts`, add a describe beside the condition one:

```ts
describe('the rows a serviser writes in himself', () => {
  it('stores and returns both written-in lists', async () => {
    const serviser = await floorActor()
    const created = await service.create(createInput(), actorContext(serviser.id))

    const updated = await service.update(
      created.id,
      {
        extraChecklist: [{ name: 'Gumeni patosnici', value: true }],
        extraDamages: ['felne izgrebane', 'nedostaje poklopac'],
      },
      serviser,
      actorContext(serviser.id),
    )

    expect(updated.extraChecklist).toEqual([{ name: 'Gumeni patosnici', value: true }])
    expect(updated.extraDamages).toEqual(['felne izgrebane', 'nedostaje poklopac'])
  })

  it('starts empty rather than null, so nothing downstream has to guard', async () => {
    const serviser = await floorActor()
    const created = await service.create(createInput(), actorContext(serviser.id))

    expect(created.extraChecklist).toEqual([])
    expect(created.extraDamages).toEqual([])
  })

  it('refuses both lists once the order is signed, admin included', async () => {
    // The freeze is part H's, and it works by field name — these two are frozen by not being on
    // FREE_AFTER_SIGNING. The test exists because that is an absence, and an absence is exactly what
    // a later edit removes without noticing.
    const serviser = await floorActor()
    const admin = await officeActor()
    const orderId = await signedOrder(serviser)

    await expect(
      service.update(orderId, { extraDamages: ['felne izgrebane'] }, serviser, actorContext(serviser.id)),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      service.update(orderId, { extraChecklist: [{ name: 'Patosnici', value: true }] }, admin, actorContext(admin.id)),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('lets a written-in row alone satisfy the signing rule', async () => {
    const serviser = await floorActor()
    const created = await service.create(createInput(), actorContext(serviser.id))
    await service.update(
      created.id,
      { extraChecklist: [{ name: 'Gumeni patosnici', value: false }] },
      serviser,
      actorContext(serviser.id),
    )

    const signed = await service.sign(
      created.id,
      { technicianSignature: 'M 0 0 L 10 10', ownerSignature: 'M 5 5 L 20 20', photosExpected: 0 },
      serviser,
      actorContext(serviser.id),
    )

    expect(signed.signedAt).not.toBeNull()
  })

  it('refuses a blank name on the wire, so the paper never carries an empty row', async () => {
    const serviser = await floorActor()
    const created = await service.create(createInput(), actorContext(serviser.id))

    await expect(
      service.update(created.id, { extraChecklist: [{ name: '   ', value: true }] }, serviser, actorContext(serviser.id)),
    ).rejects.toBeTruthy()
  })
})
```

⚠️ Check against the file first and adapt the test, not the production code: whether the update path validates through Zod at the service or the controller (if the blank-name case is a controller-level parse, assert it against the validator directly rather than through `service.update`).

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm --filter api test:integration -- intake-orders`
Expected: FAIL — the fields are stripped or unknown.

- [ ] **Step 3: Carry the columns through the repository**

In `apps/api/src/modules/intake-orders/intake-orders.repository.ts`, add `extraChecklist` and `extraDamages` everywhere `checklist` already appears — the select column map, the insert defaults, and the update patch. Read each site and follow its existing shape rather than inventing one.

- [ ] **Step 4: Pass the written-in rows to the rule**

In `apps/api/src/modules/intake-orders/intake-orders.service.ts`, `sign()`:

```ts
if (
  !isIntakeConditionRecorded(
    before.checklist,
    before.extraChecklist,
    before.equipmentNote,
    await this.checklistCatalog.countActiveItems(),
  )
) {
  throw new ValidationError('Intake order: the recorded condition is empty')
}
```

- [ ] **Step 5: Run the whole intake suite**

Run: `pnpm --filter api test:integration -- intake-orders`
Expected: all green, including everything that was already there.

- [ ] **Step 6: Prove the tests bite (mutation)**

Add `'extraDamages'` to `FREE_AFTER_SIGNING` and re-run: the signed-refusal test must go red. Then revert and pass `[]` instead of `before.extraChecklist` in `sign()`: the written-in-row-satisfies-signing test must go red. **Revert both**, confirm green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src packages/shared/src
git commit -m "feat(api): the written-in rows travel with the order, and the signing freeze already covers them"
```

---

### Task 4 (C-2 + C-3): The wizard writes them, the detail only reads them

**Files:**
- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-wizard-state.ts` (`IntakeWizardValues`, `emptyIntakeWizardValues`, `toUpdateInput`, `valuesFromOrder`)
- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-checklist-grid.tsx` (`countConfirmed`, the written-in rows)
- Modify: `apps/internal-web/src/features/intake-orders/wizard/step-checklist.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/wizard/step-damage-photos.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/wizard/intake-wizard.tsx` (the rule's call site)
- Modify: `apps/internal-web/src/features/intake-orders/detail/card-condition.tsx`, `detail/card-damages.tsx`
- Create: `apps/internal-web/src/features/intake-orders/wizard/intake-extra-row-adder.tsx`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`
- Modify/Create: tests beside each

**Interfaces:**
- Consumes: everything from Tasks 2–3.
- Produces: `IntakeExtraRowAdder` — one component used by both steps, `{ label, placeholder, onAdd }`, clears its field and stays open after adding.

- [ ] **Step 1: Add the messages to both locales, then compile**

`sr.json`:

```json
"intake_extra_add_item": "+ Dodaj stavku",
"intake_extra_add_defect": "+ Dodaj nedostatak",
"intake_extra_item_placeholder": "npr. Gumeni patosnici",
"intake_extra_defect_placeholder": "npr. felne izgrebane",
"intake_extra_confirm": "Dodaj",
"intake_extra_remove": "Ukloni",
"intake_section_other_damages": "OSTALO (bez oznake na šemi)",
"intake_print_section_other_damages": "OSTALI NEDOSTACI"
```

`en.json`:

```json
"intake_extra_add_item": "+ Add item",
"intake_extra_add_defect": "+ Add defect",
"intake_extra_item_placeholder": "e.g. Rubber mats",
"intake_extra_defect_placeholder": "e.g. wheels scratched",
"intake_extra_confirm": "Add",
"intake_extra_remove": "Remove",
"intake_section_other_damages": "OTHER (not marked on the diagram)",
"intake_print_section_other_damages": "OTHER DEFECTS"
```

Then: `pnpm --filter @mr/i18n run compile`

- [ ] **Step 2: Write the failing tests**

In `apps/internal-web/src/features/intake-orders/wizard/__tests__/step-checklist.test.tsx`:

```tsx
it('counts the written-in rows in the total, which is never a literal', async () => {
  // The same class of bug the browser caught in part B ("Korak 2 / 5" over four steps): a total that
  // does not move when the list does.
  const values = {
    ...emptyIntakeWizardValues(),
    extraChecklist: [{ name: 'Gumeni patosnici', value: true }],
  }

  renderStepChecklist(catalogOf(8), values)

  expect(screen.getByText(m.intake_checklist_confirmed({ confirmed: 1, total: 9 }))).toBeDefined()
})

it('gives a written-in row the same DA/NE pair as a catalog row', async () => {
  const user = userEvent.setup()
  const { onPatch } = renderStepChecklist(catalogOf(2), {
    ...emptyIntakeWizardValues(),
    extraChecklist: [{ name: 'Gumeni patosnici', value: null }],
  })

  await user.click(
    screen.getByRole('group', { name: 'Gumeni patosnici' }).getByRole('button', { name: m.intake_checklist_no() }),
  )

  expect(onPatch).toHaveBeenCalledWith({
    extraChecklist: [{ name: 'Gumeni patosnici', value: false }],
  })
})

it('adds on Enter and clears the field, because a serviser adds two or three at once', async () => {
  const user = userEvent.setup()
  const { onPatch } = renderStepChecklist(catalogOf(2))

  await user.click(screen.getByRole('button', { name: m.intake_extra_add_item() }))
  const field = screen.getByPlaceholderText(m.intake_extra_item_placeholder())
  await user.type(field, 'Gumeni patosnici{Enter}')

  expect(onPatch).toHaveBeenCalledWith({
    extraChecklist: [{ name: 'Gumeni patosnici', value: null }],
  })
  expect((field as HTMLInputElement).value).toBe('')
})

it('will not add a blank name, and says nothing about it', async () => {
  const user = userEvent.setup()
  const { onPatch } = renderStepChecklist(catalogOf(2))

  await user.click(screen.getByRole('button', { name: m.intake_extra_add_item() }))
  await user.type(screen.getByPlaceholderText(m.intake_extra_item_placeholder()), '   ')

  expect(screen.getByRole('button', { name: m.intake_extra_confirm() })).toBeDisabled()
  expect(onPatch).not.toHaveBeenCalled()
})
```

In `apps/internal-web/src/features/intake-orders/wizard/__tests__/step-damage-photos.test.tsx`:

```tsx
it('counts the unmarked defects in the card total', async () => {
  renderStepDamagePhotos({
    ...emptyIntakeWizardValues(),
    damages: [damageAt(100, 60)],
    extraDamages: ['felne izgrebane', 'nedostaje poklopac'],
  })

  // 1 marker + 2 written in — a card saying "1" over a list of three is a lie on evidence.
  expect(screen.getByText(m.intake_card_damages_count({ count: 3 }))).toBeDefined()
})

it('shows the OSTALO heading only once there is a row under it, but always the add button', async () => {
  renderStepDamagePhotos({ ...emptyIntakeWizardValues(), extraDamages: [] })

  expect(screen.queryByText(m.intake_section_other_damages())).toBeNull()
  expect(screen.getByRole('button', { name: m.intake_extra_add_defect() })).toBeDefined()
})
```

⚠️ Adapt every helper name (`renderStepChecklist`, `catalogOf`, `renderStepDamagePhotos`, `damageAt`, and the real card-count message key) to what those test files already use — read the top of each before writing.

- [ ] **Step 3: Run and watch them fail**

Run: `pnpm --filter internal-web test -- step-checklist step-damage-photos`
Expected: FAIL — no such fields, no such controls.

- [ ] **Step 4: Carry the two lists through the wizard's state**

In `intake-wizard-state.ts`: add `extraChecklist: IntakeExtraChecklist` and `extraDamages: IntakeExtraDamages` to `IntakeWizardValues`; `emptyIntakeWizardValues()` gives both `[]`; `toUpdateInput` sends both straight through (no defaulting dance — unlike `checklist`, these are not seeded from a catalog); `valuesFromOrder` copies both with `[...]`.

- [ ] **Step 5: Build the one adder both steps use**

Create `apps/internal-web/src/features/intake-orders/wizard/intake-extra-row-adder.tsx`:

```tsx
/**
 * The `+` both lists share. Closed it is one button; open it is a field that keeps itself open after
 * adding, because a serviser standing at the car writes two or three in a row. A blank name simply
 * disables the confirm — there is no error message, because there is nothing to explain.
 */
export function IntakeExtraRowAdder({
  label,
  placeholder,
  onAdd,
}: {
  label: string
  placeholder: string
  onAdd: (name: string) => void
}): ReactElement
```

Behaviour: `Enter` in the field adds; the field clears and keeps focus; `Escape` or blur with an empty field closes it back to the button.

- [ ] **Step 6: Step 2 — the written-in rows**

`countConfirmed` gains the written-in rows (still counting `true`/`false` only), `IntakeChecklistGrid` renders them under the catalog rows with the same DA/NE pair plus a `✕`, and `step-checklist.tsx` feeds `intake_checklist_confirmed` a total of `items.length + values.extraChecklist.length` — **never a literal**.

- [ ] **Step 7: Step 3 — the OSTALO block**

Under the numbered defect list: the heading (only when there is at least one row), the rows with `✕`, then the adder (always). The card's defect count becomes `damages.length + extraDamages.length`.

- [ ] **Step 8: The rule's call site in the wizard**

In `intake-wizard.tsx`, pass the written-in rows to the widened predicate:

```ts
const conditionRecorded = isIntakeConditionRecorded(
  values.checklist,
  values.extraChecklist,
  values.equipmentNote,
  checklistItems.length,
)
```

- [ ] **Step 9: The detail — read only**

`card-condition.tsx` renders the written-in rows in the same place and shape as the catalog ones; `card-damages.tsx` gains the OSTALO block. **No `+` and no `✕` anywhere on the detail** — after signing the record is frozen (part H), and an affordance that only sometimes works is worse than none.

- [ ] **Step 10: Run the whole internal-web suite**

Run: `pnpm --filter internal-web test`
Expected: green, including the condition-gate tests from 12.08.

- [ ] **Step 11: Prove the tests bite (mutation)**

Change the total back to `items.length` and re-run: the counter test must go red. Then make the OSTALO heading render unconditionally: its test must go red. **Revert both**, confirm green.

- [ ] **Step 12: Commit**

```bash
git add apps/internal-web/src packages/i18n/src/messages
git commit -m "feat(intake): the serviser can write in what the lists do not offer"
```

---

### Task 5 (C-4): The paper, and the measurement that decides the caps

**Files:**
- Modify: `apps/internal-web/src/features/intake-orders/print/intake-print-data.ts`
- Modify: `apps/internal-web/src/features/intake-orders/print/intake-print-condition.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/print/intake-print-damages.tsx`
- Modify: tests beside each

⚠️⚠️ **This is the one real technical danger in C.** V-7 measured that 12 defects in a single column need 1247px against a fixed 1123 and carry the footer with both signatures onto a second page. The caps are **measured, never guessed**, and the leftovers reuse the message that already exists — `intake_print_damages_more` — with `{count}` as the SUM of both overflows, because the sheet tells the customer how many defects did not fit, not which list they were in.

⚠️ The footer is `mt-auto`, so `scrollHeight === clientHeight` holds **whenever it fits**. That comparison is binary — it can say "fits" or "does not fit", and it can never tell you how much room is left.

- [ ] **Step 1: Write the failing print tests**

```tsx
it('prints a written-in row like any other, and an unanswered one as a dash', () => {
  const model = buildIntakePrintModel(
    intakeOrderDetailFixture({
      checklist: {},
      extraChecklist: [
        { name: 'Gumeni patosnici', value: true },
        { name: 'Kanister', value: null },
      ],
    }),
    catalogFixture(),
    'sr',
  )

  const written = model.checklist.slice(-2)
  expect(written.map((r) => [r.label, r.mark])).toEqual([
    ['Gumeni patosnici', '✓'],
    ['Kanister', '—'],
  ])
})

it('counts the unmarked defects in the printed figure', () => {
  const model = buildIntakePrintModel(
    intakeOrderDetailFixture({ damages: [], extraDamages: ['felne izgrebane'] }),
    catalogFixture(),
    'sr',
  )

  expect(model.damageCount).toBe(1)
})
```

```tsx
it('prints the unmarked defects under their own heading, without numbers', async () => {
  await renderSheet(intakeOrderDetailFixture({ extraDamages: ['felne izgrebane'] }))

  expect(screen.getByText(m.intake_print_section_other_damages({}, { locale: 'sr' }))).toBeDefined()
  expect(screen.getByText(/felne izgrebane/)).toBeDefined()
  // No ①②③ — a number points at the drawing, and this defect is not on it.
  expect(screen.queryByTestId('print-other-1')).toBeNull()
})

it('keeps the heading off the paper when there is nothing under it', async () => {
  await renderSheet(intakeOrderDetailFixture({ extraDamages: [] }))

  expect(screen.queryByText(m.intake_print_section_other_damages({}, { locale: 'sr' }))).toBeNull()
})
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm --filter internal-web test -- intake-print`

- [ ] **Step 3: Put both lists on the sheet**

`buildIntakePrintModel`: append the written-in rows to `model.checklist` after the catalog ones (same `IntakePrintChecklistRow` shape — `mark` from the same three-state map, `key` prefixed so it cannot collide with a code); `model.damageCount` becomes markers + written-in; add `otherDamages: string[]` capped by a constant, and fold its overflow into `damagesOverflow`.

`intake-print-condition.tsx` needs **no change** — the rows arrive in the list it already renders. `intake-print-damages.tsx` gains the sub-block under the numbered list, rendered only when it has rows.

- [ ] **Step 4: MEASURE the worst case in a real browser, and set the caps from it**

Build the worst case: 12 markers + written-in defects + a checklist with written-in items + a long owner remark + 5 services + 5 materials. Follow the recipe in the `playwright-browser-verification` memory — a throwaway admin (`ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm create-admin`, deleted afterwards), a row inserted straight into Postgres (`damages[].type` must be a catalog code: `ogrebotina|udubljenje|puknuto|rdja`; `services`/`materials` are jsonb, so `jsonb_agg`), then:

```js
await page.emulateMedia({ media: 'print' })
const fits = await page.evaluate(() => {
  const s = document.getElementById('intake-print-sheet')
  return { boxH: s.offsetHeight, contentH: s.scrollHeight, fits: s.scrollHeight <= s.offsetHeight }
})
```

Raise the number of written-in rows until `fits` turns false; the cap is the last value that fit, minus one row of headroom. **Write the measured numbers into the constant's comment** — a cap with no measurement behind it is a guess somebody will "clean up" later. Delete the probe row and the throwaway admin afterwards.

- [ ] **Step 5: Run the print suite and prove the tests bite**

Run: `pnpm --filter internal-web test -- intake-print`
Then: make the OSTALO block render unconditionally — its "keeps the heading off" test must go red. Then count only markers in `damageCount` — that test must go red. **Revert both**, confirm green.

- [ ] **Step 6: Commit**

```bash
git add apps/internal-web/src/features/intake-orders/print
git commit -m "fix(intake): the paper carries the rows the lists did not offer"
```

---

### Task 6: The gate, the browser, the push

- [ ] **Step 1: Confirm the tree holds only this work** — `git status --short` must be clean.

- [ ] **Step 2: Full gate, alone on the machine**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=2 \
  && pnpm --filter api depcruise && pnpm test:integration
```

Expected: exit 0, `Cached 0/58`.

- [ ] **Step 3: sr/en parity**

```bash
node -e "const s=require('./packages/i18n/src/messages/sr.json'),e=require('./packages/i18n/src/messages/en.json');const ks=Object.keys(s),ke=Object.keys(e);console.log(ks.length,ke.length,ks.filter(k=>!ke.includes(k)),ke.filter(k=>!ks.includes(k)))"
```

- [ ] **Step 4: Drive it in a browser** — add an item and a defect through the wizard, sign, print, and confirm both reach the sheet; confirm the detail shows them with no `+` and no `✕`. Screenshot each.

- [ ] **Step 5: Report to Nikola in Serbian, then push.** Name the measured cap and what was cut to reach it. Report anything found and deliberately left alone rather than fixing it inside C.
