# V-7 Intake Printed Work Order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the detail's disabled `⎙ ŠTAMPAJ` button into a real A4 work order — one page, printed straight after signing, that the customer takes away.

**Architecture:** Frontend only. Nothing on the server changes: every field the paper needs is already on `IntakeOrderDetail`, which the detail route loads anyway. Four layers, built in order: a **pure model** that decides what survives onto one page (truncation is a rule, not a layout accident), then the **sheet** in two halves — the half that identifies the document (header, owner, condition, signatures) and the half that carries the evidence (diagram, defects, photos) — then a **preview overlay** that only lets you print once the photos have actually loaded, and finally a **measured pass** in a real browser, because "fits on one page" is not a thing jsdom can answer.

**Tech Stack:** React 19 + TanStack Router (internal-web) · Paraglide (`@mr/i18n`) · Tailwind v4 · Vitest + Testing Library · plain `@media print` CSS (no library, no server render).

**Source of truth:** `docs/superpowers/specs/2026-08-10-intake-print-v7-design.md` (decisions ⑨ ⑩ in its §1). Every pixel value below was transferred from `~/Downloads/handoff 3/prijem-prototip-v2.dc.html` lines 665–800 — the print-preview block — and must not be re-derived by eye. The house reference for the bands is `Obaveze kupca - servisera.pdf`.

## Global Constraints

- **No migration, no new permission, no server change.** If a task appears to need one, stop and report — that is a finding.
- **Exactly one A4 page. Never two.** When content overflows, cut by the rules in the model (Task 1), never by letting the page grow.
- **The sheet is the ONE place literal hex colours are allowed** — `#ed1c24` (brand red), `#17171a` (black), `#54555b` (grey), `#e6e7e9` / `#c9cacd` (rules and photo borders). It is white paper with no dark mode, so the `mri-*` tokens (which are theme-dependent) would print whatever theme the operator happened to be in. **Everywhere else in internal-web the `mri-*` rule still holds** (CLAUDE.md §5). Say so in a comment where the literals live.
- **`print-color-adjust: exact`** on the sheet, or the printer drops the red bands and the markers.
- **The silhouette and the signature box come from the modules the screen already uses** — `INTAKE_SILHOUETTES` / `INTAKE_SILHOUETTE_VIEWBOX` (`wizard/intake-silhouettes.ts`) and `SIGNATURE_VIEW_BOX` (`wizard/intake-signature-pad.tsx`). A second copy of the drawing or a retyped viewBox will drift and put every marker in the wrong place.
- **Markers, defect rows and photo badges must carry the SAME numbers.** They all number off the *printed* (possibly truncated) defect list — see Task 1.
- **The paper's language is CHOSEN at print time, not inherited from the app** (Nikola, 2026-08-10: a foreign customer may bring the car in). Every string on the sheet is resolved with an explicit locale — Paraglide compiles each message as `m.key(inputs, { locale })` (verified in `packages/i18n/src/paraglide/messages/*.js`), so the sheet renders Serbian or English **without touching the app's own locale**. The sheet must never call `m.key()` bare: that would read the ambient locale and quietly print the operator's language onto a document somebody else signs.
- **No ICU plurals.** Phrase counts so no grammatical form depends on the number.
- **sr + en key parity is CI-enforced.** New keys land in both `packages/i18n/src/messages/sr.json` and `en.json`. After editing them run `pnpm --filter @mr/i18n build` — `run compile` writes `src/paraglide` but `typecheck` reads `dist/paraglide`, so compile alone leaves typecheck insisting the key does not exist.
- **Style:** no semicolons, single quotes, 2-space indent, trailing commas. `kebab-case` files, `PascalCase` components, one primary export per file, files under 500 lines. No `any`, no non-null `!`, no nested ternaries (lookup map or a helper component), functions under 30 lines, explicit return types on exports.
- **Never start or kill the dev servers.** `pnpm dev:all` is Nikola's terminal.
- **Full gate before every commit** (`--concurrency=4`, the dev servers are running):
  `pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 && pnpm --filter api depcruise && pnpm test:integration`
- **Push when the work is genuinely finished** — gate green with `--force`, no holes.

---

## File Structure

All new files live in `apps/internal-web/src/features/intake-orders/print/`.

- `intake-print-data.ts` — **the rules.** Turns an `IntakeOrderDetail` into exactly what the page shows: labels resolved, numbers assigned, lists cut to their limits, remarks clipped. Pure, no JSX, no `m.*` calls that depend on render order. This is where the "one page" promise is actually kept, and where the tests bite.
- `intake-print-sheet.tsx` — the 794×1123 page: black header band, owner/vehicle, footer (legal sentence, amendment marker, signatures), and it composes the three blocks below.
- `intake-print-styles.ts` — the red band, the eyebrow and the two figure styles, as class strings. The **only** place the sheet's literal hex lives, so a colour cannot drift between blocks.
- `intake-print-condition.tsx` — Blok 3: red band, 8-item checklist in 4 columns, the four-figure row.
- `intake-print-damages.tsx` — Blok 4: red band, silhouette + markers, defect rows, services and materials.
- `intake-print-photos.tsx` — Blok 5: red band, six thumbnails, the overflow note.
- `intake-print-dialog.tsx` — the preview overlay (own `fixed inset-0`, like `intake-photo-lightbox.tsx` — not a Radix dialog, which would fight the print CSS) plus the print trigger and the image-load gate.
- `intake-print.css` — the `@media print` block. Follows the house pattern already in `features/claim-reports/claim-report-content-view.scss:23`: hide everything by `visibility`, show the sheet, pin it to the page origin.
- `__tests__/intake-print-data.test.ts`, `__tests__/intake-print-sheet.test.tsx`, `__tests__/intake-print-dialog.test.tsx`.

Modified:

- `apps/internal-web/src/features/intake-orders/detail/intake-detail-header.tsx` — the print button stops being disabled and opens the preview.
- `packages/i18n/src/messages/sr.json` + `en.json`.
- `docs/25-vehicle-service-intake-design.md` — §3.5 reconciled to what was built.

---

## Task 1: The rules that keep it to one page

**Files:**

- Create: `apps/internal-web/src/features/intake-orders/print/intake-print-data.ts`
- Modify: `apps/internal-web/src/features/intake-orders/intake-labels.ts:14-43` (widen the four label maps so a caller may name a locale)
- Test: `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-data.test.ts`

**Interfaces:**

- Consumes: `IntakeOrderDetail` (`@mr/shared`), `INTAKE_CHECKLIST_KEYS` (`@mr/shared`), `INTAKE_CHECKLIST_LABELS` / `INTAKE_DAMAGE_TYPE_LABELS` / `INTAKE_VEHICLE_TYPE_LABELS` / `INTAKE_ARRIVAL_MODE_LABELS` (`../intake-labels`), `INTAKE_SILHOUETTES` + `IntakeSilhouettePath` (`../wizard/intake-silhouettes`), `buildIntakePhotoUrl` (`@mr/shared`), `formatIntakeReceivedAtLong` (`../intake-status`).
- Produces, used by Tasks 2–4:
  - `PRINT_MAX_PHOTOS = 6`, `PRINT_MAX_LIST_ITEMS = 5`, `PRINT_MAX_DAMAGES = 12`, `PRINT_MAX_REMARKS = 180`
  - `interface IntakePrintChecklistRow { key: string; label: string; mark: '✓' | '✗' | '—'; muted: boolean }`
  - `interface IntakePrintDamageRow { id: string; number: number; type: string; zone: string; x: number; y: number }`
  - `interface IntakePrintPhotoCell { id: string; url: string; number: number | null }`
  - `type IntakePrintLocale = 'sr' | 'en'`
  - `interface IntakePrintModel { … }` (full shape in Step 3) — it **carries its own `locale`**, so a block component takes one prop and still resolves its captions in the chosen language
  - `buildIntakePrintModel(order: IntakeOrderDetail, locale: IntakePrintLocale): IntakePrintModel`

- [ ] **Step 1: Write the failing tests**

Create `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-data.test.ts`:

```ts
import { m, setLocale } from '@mr/i18n'
import { IntakeDamageType } from '@mr/shared'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  intakeOrderDetailFixture,
  intakePhotoFixture,
} from '../../detail/__tests__/render-detail.js'
import { buildIntakePrintModel, PRINT_MAX_DAMAGES, PRINT_MAX_PHOTOS } from '../intake-print-data.js'

function damage(n: number) {
  return {
    id: `d${n}`,
    type: IntakeDamageType.Scratch,
    x: 100 + n,
    y: 60 + n,
    zone: `Zona ${n}`,
  }
}

describe('buildIntakePrintModel', () => {
  beforeAll(() => {
    setLocale('sr', { reload: false })
  })

  it('prints an untouched checklist row as a dash, never as "no"', () => {
    // The paper is what the customer signs. A row nobody checked printed as ✕ is a statement
    // nobody made (docs/25 §4.4).
    const order = intakeOrderDetailFixture({
      checklist: {
        rezervna: true,
        dizalica: false,
        komplet: null,
        saobracajna: true,
        vozacka: true,
        prvaPomoc: true,
        prsluk: true,
        lanci: true,
      },
    })

    const marks = buildIntakePrintModel(order, 'sr').checklist.map((row) => row.mark)

    expect(marks[0]).toBe('✓')
    expect(marks[1]).toBe('✗')
    expect(marks[2]).toBe('—')
  })

  it('numbers defects from 1 in list order, and the markers carry the same numbers', () => {
    const order = intakeOrderDetailFixture({ damages: [damage(1), damage(2), damage(3)] })

    const model = buildIntakePrintModel(order, 'sr')

    expect(model.damages.map((d) => d.number)).toEqual([1, 2, 3])
    expect(model.markers.map((m) => m.number)).toEqual([1, 2, 3])
    // The circle sits on the marker, the digit sits 6px below its centre (prototype :1388).
    expect(model.markers[0]?.textY).toBe((model.markers[0]?.y ?? 0) + 6)
  })

  it('cuts the defect list at twelve and says how many were left out', () => {
    const order = intakeOrderDetailFixture({
      damages: Array.from({ length: 15 }, (_, i) => damage(i + 1)),
    })

    const model = buildIntakePrintModel(order, 'sr')

    expect(model.damages).toHaveLength(PRINT_MAX_DAMAGES)
    expect(model.damagesOverflow).toBe(3)
    // The drawing must not show markers the list does not explain.
    expect(model.markers).toHaveLength(PRINT_MAX_DAMAGES)
  })

  it('drops the badge of a photo whose defect did not make the page', () => {
    // Otherwise the paper carries a ⑬ that appears nowhere in the list beside it.
    const order = intakeOrderDetailFixture({
      damages: Array.from({ length: 15 }, (_, i) => damage(i + 1)),
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444', damageId: 'd13' })],
    })

    expect(buildIntakePrintModel(order, 'sr').photos[0]?.number).toBeNull()
  })

  it('numbers a photo by the defect it belongs to', () => {
    const order = intakeOrderDetailFixture({
      damages: [damage(1), damage(2)],
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444', damageId: 'd2' })],
    })

    expect(buildIntakePrintModel(order, 'sr').photos[0]?.number).toBe(2)
  })

  it('shows six photos and reports the rest', () => {
    const photos = Array.from({ length: 9 }, (_, i) =>
      intakePhotoFixture({ id: `4444444${i}-4444-4444-8444-444444444444`, damageId: null }),
    )
    const order = intakeOrderDetailFixture({ photos })

    const model = buildIntakePrintModel(order, 'sr')

    expect(model.photos).toHaveLength(PRINT_MAX_PHOTOS)
    expect(model.photoCount).toBe(9)
    expect(model.photoOverflowText).not.toBeNull()
  })

  it('says nothing extra when six photos are all of them', () => {
    const photos = Array.from({ length: 6 }, (_, i) =>
      intakePhotoFixture({ id: `4444444${i}-4444-4444-8444-444444444444`, damageId: null }),
    )

    expect(buildIntakePrintModel(intakeOrderDetailFixture({ photos }), 'sr').photoOverflowText)
      .toBeNull()
  })

  it('keeps five services and five materials', () => {
    const order = intakeOrderDetailFixture({
      services: ['a', 'b', 'c', 'd', 'e', 'f'],
      materials: ['1', '2', '3', '4', '5', '6', '7'],
    })

    const model = buildIntakePrintModel(order, 'sr')

    expect(model.services).toHaveLength(5)
    expect(model.materials).toHaveLength(5)
  })

  it('clips a long owner remark and marks the clip', () => {
    const order = intakeOrderDetailFixture({ ownerRemarks: 'x'.repeat(400) })

    const remarks = buildIntakePrintModel(order, 'sr').ownerRemarks

    expect(remarks.length).toBeLessThanOrEqual(181)
    expect(remarks.endsWith('…')).toBe(true)
  })

  it('says "no remarks" rather than leaving the field blank', () => {
    const order = intakeOrderDetailFixture({ ownerRemarks: null })

    expect(buildIntakePrintModel(order, 'sr').ownerRemarks.length).toBeGreaterThan(0)
  })

  it('carries the amendment stamp only when the order was amended', () => {
    expect(buildIntakePrintModel(intakeOrderDetailFixture(), 'sr').amended).toBeNull()

    const amended = buildIntakePrintModel(
      intakeOrderDetailFixture({
        amendedAt: '2026-07-28T10:00:00.000Z',
        amendedByName: 'Jelena Petrović',
      }),
      'sr',
    ).amended

    expect(amended?.by).toBe('Jelena Petrović')
    expect(amended?.at.length).toBeGreaterThan(0)
  })

  it('takes the silhouette from the order vehicle type, not from a default', () => {
    const car = buildIntakePrintModel(intakeOrderDetailFixture(), 'sr').silhouette
    const van = buildIntakePrintModel(
      intakeOrderDetailFixture({ vehicleType: 'kombi' }),
      'sr',
    ).silhouette

    expect(van).not.toEqual(car)
  })

  it('speaks the language it was asked for, not the one the app is in', () => {
    // The app is Serbian (`setLocale('sr')` above) because that is what the office works in. A
    // foreign customer still gets an English paper, and the choice must not leak into the app.
    const order = intakeOrderDetailFixture({ ownerRemarks: null })

    expect(buildIntakePrintModel(order, 'sr').ownerRemarks).toBe(
      m.intake_print_no_remarks({}, { locale: 'sr' }),
    )
    expect(buildIntakePrintModel(order, 'en').ownerRemarks).toBe(
      m.intake_print_no_remarks({}, { locale: 'en' }),
    )
    expect(buildIntakePrintModel(order, 'en').ownerRemarks).not.toBe(
      buildIntakePrintModel(order, 'sr').ownerRemarks,
    )
  })

  it('translates the labels it resolves, not just the sentences', () => {
    const order = intakeOrderDetailFixture()

    const sr = buildIntakePrintModel(order, 'sr')
    const en = buildIntakePrintModel(order, 'en')

    expect(en.checklist[0]?.label).not.toBe(sr.checklist[0]?.label)
    expect(en.arrivalMode).not.toBe(sr.arrivalMode)
  })
})
```

⚠️ `intakePhotoFixture` and `intakeOrderDetailFixture` already exist in `detail/__tests__/render-detail.tsx`. Read them first; the photo fixture takes `Partial<IntakeOrderPhoto>` and parses through the wire schema, so ids must be valid UUIDs.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter internal-web test -- intake-print-data`
Expected: FAIL — module not found.

- [ ] **Step 3: Let the label maps take a locale**

`intake-labels.ts` types all four maps as `Record<K, () => string>`, which **erases** the second
argument the compiled messages actually accept. Widen the type — the values are unchanged, and every
existing bare call site (`INTAKE_CHECKLIST_LABELS[key]()`) keeps working:

```ts
/**
 * A message as Paraglide compiles it: callable bare for the screen, or with an explicit locale for
 * the printed work order, which must speak the customer's language and not the operator's
 * (spec §1 decision, 2026-08-10). Typing these as `() => string` silently threw that away.
 */
type IntakeLabel = (inputs?: Record<string, never>, options?: { locale?: 'sr' | 'en' }) => string

export const INTAKE_CHECKLIST_LABELS: Record<IntakeChecklistKey, IntakeLabel> = { …unchanged… }
export const INTAKE_VEHICLE_TYPE_LABELS: Record<IntakeVehicleType, IntakeLabel> = { …unchanged… }
export const INTAKE_ARRIVAL_MODE_LABELS: Record<IntakeArrivalMode, IntakeLabel> = { …unchanged… }
export const INTAKE_DAMAGE_TYPE_LABELS: Record<IntakeDamageType, IntakeLabel> = { …unchanged… }
```

Run `pnpm --filter internal-web typecheck` right after: nothing else should move.

- [ ] **Step 4: Write the model**

Create `apps/internal-web/src/features/intake-orders/print/intake-print-data.ts`:

```ts
import { m } from '@mr/i18n'
import {
  buildIntakePhotoUrl,
  INTAKE_CHECKLIST_KEYS,
  type IntakeOrderDetail,
} from '@mr/shared'

import { internalIntlLocale } from '~/lib/internal-format'

import {
  INTAKE_ARRIVAL_MODE_LABELS,
  INTAKE_CHECKLIST_LABELS,
  INTAKE_DAMAGE_TYPE_LABELS,
  INTAKE_VEHICLE_TYPE_LABELS,
} from '../intake-labels'
import { formatIntakeReceivedAtLong } from '../intake-status'
import { INTAKE_SILHOUETTES, type IntakeSilhouettePath } from '../wizard/intake-silhouettes'

/**
 * One A4 page is a rule, not a preference (spec §2). These are the cuts, in the order the spec
 * applies them (§5) — and they live here rather than in the components so that "what the customer
 * receives" is decided once, in a place a test can interrogate.
 */
export const PRINT_MAX_PHOTOS = 6
export const PRINT_MAX_LIST_ITEMS = 5
export const PRINT_MAX_DAMAGES = 12
export const PRINT_MAX_REMARKS = 180

/**
 * The paper's language, chosen at print time. A foreign customer brings a car in and signs an
 * English work order while the office keeps working in Serbian — so this is an argument, never
 * `getLocale()`. Every `m.*` call below therefore names it explicitly.
 */
export type IntakePrintLocale = 'sr' | 'en'

export interface IntakePrintChecklistRow {
  key: string
  label: string
  mark: '✓' | '✗' | '—'
  /** A "no" and an unchecked row print their text grey; a "yes" prints it black. */
  muted: boolean
}

export interface IntakePrintDamageRow {
  id: string
  number: number
  type: string
  zone: string
  x: number
  y: number
}

export interface IntakePrintPhotoCell {
  id: string
  url: string
  /** The defect this photo belongs to, or null for a general shot — and null when its defect
   *  did not fit on the page, because a badge the list cannot explain is worse than no badge. */
  number: number | null
}

export interface IntakePrintModel {
  /** Travels with the data so a block component takes one prop and still resolves its captions. */
  locale: IntakePrintLocale
  orderNumber: string
  receivedAt: string
  ownerName: string
  ownerAddress: string
  ownerPhone: string
  vehicle: string
  plate: string
  vehicleTypeLabel: string
  vin: string
  mileage: string
  arrivalMode: string
  checklist: IntakePrintChecklistRow[]
  fuelLevel: number
  damageCount: number
  photoCount: number
  ownerRemarks: string
  damages: IntakePrintDamageRow[]
  /** How many defects did NOT fit; 0 when all of them did. */
  damagesOverflow: number
  services: string[]
  materials: string[]
  photos: IntakePrintPhotoCell[]
  photoOverflowText: string | null
  amended: { at: string; by: string } | null
  technicianName: string
  technicianSignature: string | null
  ownerSignature: string | null
  silhouette: readonly IntakeSilhouettePath[]
  markers: { x: number; y: number; textY: number; number: number }[]
}

const DASH = '—'

function checklistRow(
  key: (typeof INTAKE_CHECKLIST_KEYS)[number],
  value: boolean | null,
  locale: IntakePrintLocale,
): IntakePrintChecklistRow {
  const label = INTAKE_CHECKLIST_LABELS[key]({}, { locale })
  if (value === true) {
    return { key, label, mark: '✓', muted: false }
  }
  if (value === false) {
    return { key, label, mark: '✗', muted: true }
  }
  return { key, label, mark: DASH, muted: true }
}

function clipRemarks(value: string | null, locale: IntakePrintLocale): string {
  if (value === null || value.trim().length === 0) {
    return m.intake_print_no_remarks({}, { locale })
  }
  const trimmed = value.trim()
  return trimmed.length <= PRINT_MAX_REMARKS
    ? trimmed
    : `${trimmed.slice(0, PRINT_MAX_REMARKS)}…`
}

/**
 * Everything the sheet draws, already cut to size. Built from the order alone — the print has its
 * own typographic scale and a white background, so it never reads the screen's components.
 */
export function buildIntakePrintModel(
  order: IntakeOrderDetail,
  locale: IntakePrintLocale,
): IntakePrintModel {
  const damages = order.damages.slice(0, PRINT_MAX_DAMAGES).map((damage, index) => ({
    id: damage.id,
    number: index + 1,
    type: INTAKE_DAMAGE_TYPE_LABELS[damage.type]({}, { locale }),
    zone: damage.zone,
    x: damage.x,
    y: damage.y,
  }))

  // Markers, defect rows and photo badges all number off THIS list — the acceptance criterion is
  // that the three agree, and they only can if they share one source.
  const numberOf = (damageId: string | null): number | null =>
    damages.find((damage) => damage.id === damageId)?.number ?? null

  const photos = order.photos.slice(0, PRINT_MAX_PHOTOS).map((photo) => ({
    id: photo.id,
    url: buildIntakePhotoUrl(order.id, photo.id, 'thumbnail'),
    number: numberOf(photo.damageId),
  }))

  // Dates follow the paper's language too — an English work order with a Serbian long date is the
  // same mistake in a smaller place.
  const dateLocale = internalIntlLocale(locale)

  return {
    locale,
    orderNumber: order.orderNumber,
    receivedAt: formatIntakeReceivedAtLong(order.receivedAt, dateLocale),
    ownerName: order.ownerName,
    ownerAddress: order.ownerAddress ?? DASH,
    ownerPhone: order.ownerPhone,
    vehicle: order.vehicle,
    plate: order.plate,
    vehicleTypeLabel: INTAKE_VEHICLE_TYPE_LABELS[order.vehicleType]({}, { locale }).toUpperCase(),
    vin: order.vin ?? DASH,
    mileage: order.mileage === null ? DASH : `${order.mileage} km`,
    arrivalMode: INTAKE_ARRIVAL_MODE_LABELS[order.arrivalMode]({}, { locale }).toLowerCase(),
    checklist: INTAKE_CHECKLIST_KEYS.map((key) =>
      checklistRow(key, order.checklist[key], locale),
    ),
    fuelLevel: order.fuelLevel,
    damageCount: order.damages.length,
    photoCount: order.photos.length,
    ownerRemarks: clipRemarks(order.ownerRemarks, locale),
    damages,
    damagesOverflow: order.damages.length - damages.length,
    services: order.services.slice(0, PRINT_MAX_LIST_ITEMS),
    materials: order.materials.slice(0, PRINT_MAX_LIST_ITEMS),
    photos,
    photoOverflowText:
      order.photos.length > PRINT_MAX_PHOTOS
        ? m.intake_print_photos_more({ count: order.photos.length }, { locale })
        : null,
    amended:
      order.amendedAt === null
        ? null
        : {
            at: formatIntakeReceivedAtLong(order.amendedAt, dateLocale),
            by: order.amendedByName ?? m.intake_detail_amended_by_unknown({}, { locale }),
          },
    technicianName: order.technicianName,
    technicianSignature: order.technicianSignature,
    ownerSignature: order.ownerSignature,
    silhouette: INTAKE_SILHOUETTES[order.vehicleType],
    markers: damages.map((damage) => ({
      x: damage.x,
      y: damage.y,
      // The digit's baseline sits 6px below the circle's centre (prototype :1388).
      textY: damage.y + 6,
      number: damage.number,
    })),
  }
}
```

- [ ] **Step 4: Add the two strings this module needs**

`packages/i18n/src/messages/sr.json`:

```json
"intake_print_no_remarks": "Bez primedbi.",
"intake_print_photos_more": "Prikazano prvih 6 od {count} fotografija — sve se čuvaju uz digitalni nalog.",
```

`packages/i18n/src/messages/en.json`:

```json
"intake_print_no_remarks": "No remarks.",
"intake_print_photos_more": "Showing the first 6 of {count} photos — all of them are kept with the digital order.",
```

Then: `pnpm --filter @mr/i18n build`

- [ ] **Step 5: Run the tests and watch them pass**

Run: `pnpm --filter internal-web test -- intake-print-data`
Expected: PASS (12 tests).

- [ ] **Step 6: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src/features/intake-orders/print packages/i18n/src/messages
git commit -m "feat(intake): the printed order decides what fits on one page, in one place a test can read"
```

---

## Task 2: The half of the page that says whose document this is

Header band, owner and vehicle, recorded condition, and the footer that carries the legal sentence, the amendment stamp and both signatures. Built first because it is the part that must be right even when everything else is empty.

**Files:**

- Create: `apps/internal-web/src/features/intake-orders/print/intake-print-sheet.tsx`
- Create: `apps/internal-web/src/features/intake-orders/print/intake-print-condition.tsx`
- Create: `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-sheet.test.tsx`
- Modify: `packages/i18n/src/messages/sr.json` + `en.json`

**Interfaces:**

- Consumes: `buildIntakePrintModel`, `IntakePrintModel` (Task 1); `SIGNATURE_VIEW_BOX` from `../wizard/intake-signature-pad`.
- Produces: `IntakePrintSheet({ order, locale }: { order: IntakeOrderDetail; locale: IntakePrintLocale }): ReactElement` — the whole page, with `id="intake-print-sheet"` on its root (the print CSS in Task 4 targets exactly that id). `IntakePrintCondition({ model }: { model: IntakePrintModel }): ReactElement` — one prop, because the model carries the locale.
- Task 3 adds `IntakePrintDamages` and `IntakePrintPhotos` into the same sheet; leave the two slots as explicit `{/* Task 3 */}` comments so the sheet does not have to be restructured.

- [ ] **Step 1: Write the failing tests**

Create `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-sheet.test.tsx`:

```tsx
import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { intakeOrderDetailFixture, renderDetailUi } from '../../detail/__tests__/render-detail.js'
import { IntakePrintSheet } from '../intake-print-sheet.js'

describe('IntakePrintSheet', () => {
  it('names the order and the two parties', async () => {
    const order = intakeOrderDetailFixture()

    await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(screen.getByText(order.orderNumber)).toBeDefined()
    expect(screen.getAllByText(order.ownerName).length).toBeGreaterThan(0)
    expect(screen.getByText(order.technicianName)).toBeDefined()
    expect(screen.getByText(m.intake_print_title({}, { locale: 'sr' }))).toBeDefined()
  })

  it('prints an unchecked equipment row as a dash', async () => {
    const order = intakeOrderDetailFixture({
      checklist: {
        rezervna: null,
        dizalica: true,
        komplet: true,
        saobracajna: true,
        vozacka: true,
        prvaPomoc: true,
        prsluk: true,
        lanci: true,
      },
    })

    await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(screen.getByTestId('print-check-rezervna')).toHaveTextContent('—')
    expect(screen.getByTestId('print-check-dizalica')).toHaveTextContent('✓')
  })

  it('carries no amendment mark on an order nobody corrected', async () => {
    await renderDetailUi(<IntakePrintSheet order={intakeOrderDetailFixture()} locale="sr" />)

    expect(screen.queryByText(m.intake_print_amended({}, { locale: 'sr' }))).toBeNull()
  })

  it('marks a corrected order neutrally, with when and who', async () => {
    // Neutral by decision ⑩: `amended_at` has no kind, so naming one would print the wrong
    // reason every time a phone number was the thing corrected.
    const order = intakeOrderDetailFixture({
      amendedAt: '2026-07-28T10:00:00.000Z',
      amendedByName: 'Jelena Petrović',
    })

    await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(screen.getByText(m.intake_print_amended({}, { locale: 'sr' }))).toBeDefined()
    expect(screen.getByText(/Jelena Petrović/)).toBeDefined()
  })

  it('draws both signatures as vector paths, not images', async () => {
    const order = intakeOrderDetailFixture()

    const { container } = await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    const paths = container.querySelectorAll('[data-testid="print-signature"] path')
    expect(paths).toHaveLength(2)
    expect(paths[0]?.getAttribute('d')).toBe(order.technicianSignature)
  })

  it('counts the photos in the legal sentence, because that is what is being signed for', async () => {
    await renderDetailUi(<IntakePrintSheet order={intakeOrderDetailFixture()} locale="sr" />)

    expect(
      screen.getByText(
        m.intake_print_legal(
          { count: 0, number: intakeOrderDetailFixture().orderNumber },
          { locale: 'sr' },
        ),
      ),
    ).toBeDefined()
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter internal-web test -- intake-print-sheet`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the strings**

`packages/i18n/src/messages/sr.json`:

```json
"intake_print_title": "Radni nalog",
"intake_print_subtitle": "Prijem vozila u servis",
"intake_print_section_owner": "VLASNIK",
"intake_print_section_vehicle": "VOZILO · {type}",
"intake_print_section_condition": "ZATEČENO STANJE",
"intake_print_fuel": "GORIVO",
"intake_print_defects": "NEDOSTACI",
"intake_print_photos": "FOTOGRAFIJA",
"intake_print_remarks": "PRIMEDBE VLASNIKA",
"intake_print_amended": "⚠ NALOG JE MENJAN POSLE POTPISA",
"intake_print_legal": "Potpisom se potvrđuje da je zatečeno stanje vozila, opreme i uočenih nedostataka verno prikazano u ovom nalogu, uključujući priloženu fotodokumentaciju ({count} fotografija, arhivirano uz nalog {number}).",
"intake_print_role_technician": "SERVISER",
"intake_print_role_owner": "VLASNIK",
```

`packages/i18n/src/messages/en.json`:

```json
"intake_print_title": "Work order",
"intake_print_subtitle": "Vehicle service intake",
"intake_print_section_owner": "OWNER",
"intake_print_section_vehicle": "VEHICLE · {type}",
"intake_print_section_condition": "CONDITION AT INTAKE",
"intake_print_fuel": "FUEL",
"intake_print_defects": "DEFECTS",
"intake_print_photos": "PHOTOS",
"intake_print_remarks": "OWNER'S REMARKS",
"intake_print_amended": "⚠ THE ORDER WAS CHANGED AFTER SIGNING",
"intake_print_legal": "By signing, it is confirmed that the condition of the vehicle, its equipment and the defects found are faithfully recorded in this order, including the attached photo documentation ({count} photos, archived with order {number}).",
"intake_print_role_technician": "TECHNICIAN",
"intake_print_role_owner": "OWNER",
```

Then: `pnpm --filter @mr/i18n build`

- [ ] **Step 4: Write the condition block**

Create `intake-print-condition.tsx`:

```tsx
import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import type { ReactElement } from 'react'

import { PRINT_BAND, PRINT_FIGURE, PRINT_FIGURE_LABEL } from './intake-print-styles'
import type { IntakePrintModel } from './intake-print-data'

/**
 * Blok 3 — the recorded condition. The eight equipment rows print in four columns, and an
 * untouched row prints `—`: collapsing the third state to ✕ puts a statement nobody made onto a
 * document the customer signs (`docs/25` §4.4).
 */
export function IntakePrintCondition({ model }: { model: IntakePrintModel }): ReactElement {
  const { locale } = model

  return (
    <section>
      <div className={PRINT_BAND}>{m.intake_print_section_condition({}, { locale })}</div>

      <div className="mt-[9px] grid grid-cols-4 gap-x-5 gap-y-[6px] text-[11.5px]">
        {model.checklist.map((row) => (
          <div
            key={row.key}
            data-testid={`print-check-${row.key}`}
            className={cn('flex gap-2', row.muted && 'text-[#54555b]')}
          >
            <span
              className={cn(
                'font-mono font-bold',
                row.mark === '✗' ? 'text-[#ed1c24]' : 'text-[#17171a]',
              )}
            >
              {row.mark}
            </span>
            {row.label}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-8 border-t border-[#e6e7e9] pt-[11px]">
        <div>
          <div className={PRINT_FIGURE_LABEL}>{m.intake_print_fuel({}, { locale })}</div>
          <div className={PRINT_FIGURE}>{model.fuelLevel}/8</div>
        </div>
        <div>
          <div className={PRINT_FIGURE_LABEL}>{m.intake_print_defects({}, { locale })}</div>
          <div className={cn(PRINT_FIGURE, 'text-[#ed1c24]')}>{model.damageCount}</div>
        </div>
        <div>
          <div className={PRINT_FIGURE_LABEL}>{m.intake_print_photos({}, { locale })}</div>
          <div className={PRINT_FIGURE}>{model.photoCount}</div>
        </div>
        <div className="flex-1">
          <div className={PRINT_FIGURE_LABEL}>{m.intake_print_remarks({}, { locale })}</div>
          <div className="mt-[2px] text-[11.5px] leading-[1.5]">{model.ownerRemarks}</div>
        </div>
      </div>
    </section>
  )
}
```

Create `intake-print-styles.ts` alongside it (the literals live in exactly one place):

```ts
/**
 * The sheet is the ONE place in internal-web where literal hex is correct. It is white paper with
 * no dark mode, so the theme-dependent `mri-*` tokens would print whatever theme the operator
 * happened to be sitting in. Everywhere else CLAUDE.md §5 still applies.
 *
 * The red band replaces the prototype's thin red eyebrow: Nikola's decision ⑨ (2026-08-10) is
 * that this paper must look like the other forms the customer already gets ("Obaveze kupca"),
 * which carry solid black and red bands.
 */
export const PRINT_BAND =
  'bg-[#ed1c24] px-[11px] py-[5px] font-mono text-[10px] font-extrabold uppercase tracking-[0.16em] text-white'

export const PRINT_EYEBROW =
  'font-mono text-[8.5px] font-bold uppercase tracking-[0.2em] text-[#ed1c24]'

export const PRINT_FIGURE_LABEL = 'font-mono text-[8.5px] tracking-[0.16em] text-[#54555b]'

export const PRINT_FIGURE = 'font-mono text-[19px] font-bold'

export const PRINT_RULE = 'h-px bg-[#e6e7e9]'
```

- [ ] **Step 5: Write the sheet**

Create `intake-print-sheet.tsx`. Values are the prototype's (`prijem-prototip-v2.dc.html:672-800`), with the header turned into a black band per decision ⑨:

```tsx
import { m } from '@mr/i18n'
import type { IntakeOrderDetail } from '@mr/shared'
import type { ReactElement } from 'react'

import { SIGNATURE_VIEW_BOX } from '../wizard/intake-signature-pad'
import { IntakePrintCondition } from './intake-print-condition'
import {
  buildIntakePrintModel,
  type IntakePrintLocale,
  type IntakePrintModel,
} from './intake-print-data'
import { PRINT_EYEBROW, PRINT_RULE } from './intake-print-styles'

/**
 * A4 at 96dpi. A FIXED height, never `min-height`: the page must not be allowed to grow into a
 * second one — when the content is too tall the rules in `intake-print-data.ts` are what gives,
 * not the paper.
 */
const SHEET = 'flex h-[1123px] w-[794px] flex-none flex-col bg-white text-[#17171a]'

function SignatureBox({ path, role, name }: { path: string | null; role: string; name: string }) {
  return (
    <div>
      <div className="h-[50px]" data-testid="print-signature">
        {path === null ? null : (
          <svg viewBox={SIGNATURE_VIEW_BOX} width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
            <path d={path} stroke="#17171a" strokeWidth={4} fill="none" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="h-px bg-[#17171a]" />
      <div className="mt-[5px] flex justify-between">
        <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.16em] text-[#54555b]">
          {role}
        </span>
        <span className="text-[11px] font-bold">{name}</span>
      </div>
    </div>
  )
}

/**
 * The printed work order. Rendered from the order's data, never from the screen's components:
 * the paper has its own typographic scale, a white background and no theme.
 *
 * `print-color-adjust: exact` is not decoration — without it the printer drops the red bands and
 * the defect markers, and the sheet loses the two things a reader navigates by.
 */
export function IntakePrintSheet({
  order,
  locale,
}: {
  order: IntakeOrderDetail
  /** Chosen in the preview, never read from the app: the paper speaks the customer's language. */
  locale: IntakePrintLocale
}): ReactElement {
  const model: IntakePrintModel = buildIntakePrintModel(order, locale)

  return (
    <div
      id="intake-print-sheet"
      className={SHEET}
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      {/* Blok 1 — the black band, edge to edge, as "Obaveze kupca" carries it. */}
      <header className="flex flex-none items-center gap-4 bg-[#17171a] px-[54px] py-[18px] text-white">
        <img src="/internal/logo-white.png" alt="MR Engines" className="h-[30px] w-auto" />
        <div className="ml-2">
          <div className="text-[22px] font-black uppercase leading-none tracking-[-0.02em]">
            {m.intake_print_title({}, { locale })}
          </div>
          <div className="mt-1 text-[10.5px] text-[#b9babd]">{m.intake_print_subtitle({}, { locale })}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-[20px] font-bold">{model.orderNumber}</div>
          <div className="font-mono text-[9.5px] tracking-[0.08em] text-[#b9babd]">
            {model.receivedAt}
          </div>
        </div>
      </header>

      {/* `flex-1 min-h-0` rather than a calc against the band's height: the band is content-sized,
          and a hard-coded number here would silently push the footer off the page the day its
          padding changes. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-[54px] pb-[50px] pt-[18px]">
        {/* Blok 2 */}
        <div className="grid grid-cols-2 gap-[34px]">
          <div>
            <div className={PRINT_EYEBROW}>{m.intake_print_section_owner({}, { locale })}</div>
            <div className="mt-[7px] text-[15px] font-extrabold">{model.ownerName}</div>
            <div className="mt-[3px] text-[11.5px] leading-[1.6] text-[#54555b]">
              {model.ownerAddress}
              <br />
              <span className="font-mono">{model.ownerPhone}</span>
            </div>
          </div>
          <div>
            <div className={PRINT_EYEBROW}>
              {m.intake_print_section_vehicle({ type: model.vehicleTypeLabel }, { locale })}
            </div>
            <div className="mt-[7px] text-[15px] font-extrabold">
              {model.vehicle} · <span className="font-mono">{model.plate}</span>
            </div>
            <div className="mt-[3px] text-[11.5px] leading-[1.6] text-[#54555b]">
              <span className="font-mono">{model.vin}</span>
              <br />
              <span className="font-mono">{model.mileage}</span> · {model.arrivalMode}
            </div>
          </div>
        </div>

        <div className={PRINT_RULE} />

        <IntakePrintCondition model={model} />

        {/* Task 3 mounts IntakePrintDamages here */}
        {/* Task 3 mounts IntakePrintPhotos here */}

        {/* Blok 7 — pinned to the bottom whatever the blocks above did. */}
        <footer className="mt-auto border-t-[2.5px] border-[#ed1c24] pt-[14px]">
          {model.amended === null ? null : (
            <div className="mb-[11px] flex items-center gap-2.5 border-[1.5px] border-[#ed1c24] bg-[rgba(237,28,36,0.06)] px-[11px] py-[7px]">
              <span className="flex-none font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#ed1c24]">
                {m.intake_print_amended({}, { locale })}
              </span>
              <span className="ml-auto font-mono text-[9px]">
                {model.amended.at} · {model.amended.by}
              </span>
            </div>
          )}

          <div className="mb-[14px] max-w-[600px] text-[9.5px] leading-[1.5] text-[#54555b]">
            {m.intake_print_legal({ count: model.photoCount, number: model.orderNumber }, { locale })}
          </div>

          <div className="grid grid-cols-2 gap-10">
            <SignatureBox
              path={model.technicianSignature}
              role={m.intake_print_role_technician({}, { locale })}
              name={model.technicianName}
            />
            <SignatureBox
              path={model.ownerSignature}
              role={m.intake_print_role_owner({}, { locale })}
              name={model.ownerName}
            />
          </div>
        </footer>
      </div>
    </div>
  )
}
```

⚠️ `internalIntlLocale` lives in `~/lib/internal-format` and is what the rest of the module passes to date formatting — read it before using; if its signature differs, follow the call in `detail/tab-overview.tsx`.

- [ ] **Step 6: Run the tests and watch them pass**

Run: `pnpm --filter internal-web test -- intake-print-sheet`
Expected: PASS (6 tests).

- [ ] **Step 7: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src/features/intake-orders/print packages/i18n/src/messages
git commit -m "feat(intake): the printed order carries its header, its condition and both signatures"
```

---

## Task 3: The half of the page that carries the evidence

**Files:**

- Create: `apps/internal-web/src/features/intake-orders/print/intake-print-damages.tsx`
- Create: `apps/internal-web/src/features/intake-orders/print/intake-print-photos.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/print/intake-print-sheet.tsx` (mount both)
- Modify: `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-sheet.test.tsx`
- Modify: `packages/i18n/src/messages/sr.json` + `en.json`

**Interfaces:**

- Consumes: `IntakePrintModel` (Task 1), `INTAKE_SILHOUETTE_VIEWBOX` from `../wizard/intake-silhouettes`, `PRINT_BAND` / `PRINT_EYEBROW` / `PRINT_RULE` (Task 2).
- Produces: `IntakePrintDamages({ model }): ReactElement`, `IntakePrintPhotos({ model }): ReactElement`.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/intake-print-sheet.test.tsx`:

```tsx
describe('IntakePrintSheet — evidence', () => {
  function damage(n: number) {
    return { id: `d${n}`, type: IntakeDamageType.Scratch, x: 100 + n, y: 60 + n, zone: `Zona ${n}` }
  }

  it('draws the silhouette of the order vehicle type, not a car by default', async () => {
    const { container } = await renderDetailUi(
      <IntakePrintSheet
        order={intakeOrderDetailFixture({ vehicleType: IntakeVehicleType.Van })}
        locale="sr"
      />,
    )

    const paths = container.querySelectorAll('[data-testid="print-silhouette"] path')
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.getAttribute('d')).toBe(INTAKE_SILHOUETTES[IntakeVehicleType.Van][0]?.d)
  })

  it('puts the same number on the marker, the defect row and the photo badge', async () => {
    const order = intakeOrderDetailFixture({
      damages: [damage(1), damage(2)],
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444', damageId: 'd2' })],
    })

    const { container } = await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(container.querySelector('[data-testid="print-marker-2"]')).not.toBeNull()
    expect(screen.getByTestId('print-damage-2')).toHaveTextContent('Zona 2')
    expect(screen.getByTestId('print-photo-badge')).toHaveTextContent('2')
  })

  it('says there were none rather than leaving the defect list blank', async () => {
    await renderDetailUi(<IntakePrintSheet order={intakeOrderDetailFixture({ damages: [] })} />)

    expect(screen.getByText(m.intake_print_no_damage({}, { locale: 'sr' }))).toBeDefined()
  })

  it('says how many defects were left off the page', async () => {
    const order = intakeOrderDetailFixture({
      damages: Array.from({ length: 15 }, (_, i) => damage(i + 1)),
    })

    await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(
      screen.getByText(m.intake_print_damages_more({ count: 3, number: order.orderNumber }, { locale: 'sr' })),
    ).toBeDefined()
  })

  it('prints all markers red, whatever the defect type', async () => {
    // Amber and grey do not print legibly — the screen's colour map is deliberately not reused.
    const order = intakeOrderDetailFixture({
      damages: [{ ...damage(1), type: IntakeDamageType.Rust }],
    })

    const { container } = await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(container.querySelector('[data-testid="print-marker-1"] circle')?.getAttribute('fill'))
      .toBe('#ed1c24')
  })
})
```

Add the imports the block needs at the top of the file: `IntakeDamageType`, `IntakeVehicleType` from `@mr/shared`, `INTAKE_SILHOUETTES` from `../../wizard/intake-silhouettes.js`, `intakePhotoFixture` from the render helper.

The enum members are `Car: 'auto'`, `Van: 'kombi'`, `Pickup: 'kamionet'`, `Suv: 'dzip'`
(`packages/shared/src/enums.ts:182`) — `IntakeVehicleType.Van` above is correct as written.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter internal-web test -- intake-print-sheet`
Expected: FAIL — no silhouette, no markers, no photo grid.

- [ ] **Step 3: Add the two strings**

`sr.json`: `"intake_print_section_scheme": "ŠEMA I NEDOSTACI"`, `"intake_print_section_defects": "UOČENI NEDOSTACI"`, `"intake_print_section_services": "USLUGE"`, `"intake_print_section_materials": "MATERIJAL"`, `"intake_print_section_photos": "FOTODOKUMENTACIJA · {count}"`, `"intake_print_no_damage": "Nema uočenih nedostataka pri prijemu."`, `"intake_print_damages_more": "…i još {count} — vidi digitalni nalog {number}"`.

`en.json`: `"intake_print_section_scheme": "DIAGRAM AND DEFECTS"`, `"intake_print_section_defects": "DEFECTS FOUND"`, `"intake_print_section_services": "SERVICES"`, `"intake_print_section_materials": "MATERIALS"`, `"intake_print_section_photos": "PHOTO DOCUMENTATION · {count}"`, `"intake_print_no_damage": "No defects were found at intake."`, `"intake_print_damages_more": "…and {count} more — see digital order {number}"`.

Then: `pnpm --filter @mr/i18n build`

- [ ] **Step 4: Write the damages block**

Create `intake-print-damages.tsx`:

```tsx
import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

import { INTAKE_SILHOUETTE_VIEWBOX } from '../wizard/intake-silhouettes'
import type { IntakePrintModel } from './intake-print-data'
import { PRINT_BAND, PRINT_EYEBROW } from './intake-print-styles'

/**
 * Blok 4 — the drawing and what it means. Every marker prints solid red with a white digit,
 * whatever the defect type: the screen's amber and grey do not survive a printer, and a marker
 * nobody can see is a defect the customer never agreed to.
 */
export function IntakePrintDamages({ model }: { model: IntakePrintModel }): ReactElement {
  const { locale } = model

  return (
    <section>
      <div className={PRINT_BAND}>{m.intake_print_section_scheme({}, { locale })}</div>

      <div className="mt-[9px] grid grid-cols-[186px_1fr] gap-7">
        <svg
          data-testid="print-silhouette"
          width={146}
          height={238}
          viewBox={INTAKE_SILHOUETTE_VIEWBOX}
          fill="none"
          preserveAspectRatio="xMidYMid meet"
          className="text-[#17171a]"
        >
          {model.silhouette.map((path, index) => (
            <path
              key={index}
              d={path.d}
              fill="currentColor"
              fillOpacity={path.op === '0' ? '0' : '.05'}
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {model.markers.map((marker) => (
            <g
              key={marker.number}
              data-testid={`print-marker-${marker.number}`}
              fontFamily="JetBrains Mono, monospace"
              fontSize={15}
              fontWeight={700}
              textAnchor="middle"
            >
              <circle cx={marker.x} cy={marker.y} r={17} fill="#ed1c24" />
              <text x={marker.x} y={marker.textY} fill="#fff">
                {marker.number}
              </text>
            </g>
          ))}
        </svg>

        <div className="flex flex-col gap-[14px]">
          <div>
            <div className={PRINT_EYEBROW}>{m.intake_print_section_defects({}, { locale })}</div>
            {model.damages.map((damage) => (
              <div
                key={damage.id}
                data-testid={`print-damage-${damage.number}`}
                className="flex gap-3 border-b border-[#e6e7e9] py-[5px] text-[12px]"
              >
                <span className="w-4 font-mono font-bold">{damage.number}</span>
                <span className="flex-1">{damage.type}</span>
                <span className="text-[#54555b]">{damage.zone}</span>
              </div>
            ))}
            {model.damages.length === 0 ? (
              <p className="text-[11.5px] italic text-[#54555b]">{m.intake_print_no_damage({}, { locale })}</p>
            ) : null}
            {model.damagesOverflow > 0 ? (
              <p className="mt-[5px] text-[9.5px] text-[#54555b]">
                {m.intake_print_damages_more(
                  { count: model.damagesOverflow, number: model.orderNumber },
                  { locale },
                )}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-[22px]">
            <div>
              <div className={PRINT_EYEBROW}>{m.intake_print_section_services({}, { locale })}</div>
              {model.services.map((service) => (
                <div key={service} className="text-[12px] leading-[1.8]">
                  {service}
                </div>
              ))}
            </div>
            <div>
              <div className={PRINT_EYEBROW}>{m.intake_print_section_materials({}, { locale })}</div>
              {model.materials.map((material) => (
                <div key={material} className="text-[12px] leading-[1.8]">
                  {material}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Write the photos block**

Create `intake-print-photos.tsx`:

```tsx
import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

import type { IntakePrintModel } from './intake-print-data'
import { PRINT_BAND } from './intake-print-styles'

/**
 * Blok 5 — six thumbnails, each carrying the number of the defect it documents. The badge is what
 * ties a photograph to a line in the list; without it the photos are six pictures of a car.
 */
export function IntakePrintPhotos({ model }: { model: IntakePrintModel }): ReactElement {
  const { locale } = model

  return (
    <section>
      <div className={PRINT_BAND}>
        {m.intake_print_section_photos({ count: model.photoCount }, { locale })}
      </div>

      <div className="mt-[9px] grid grid-cols-6 gap-2">
        {model.photos.map((photo) => (
          <span
            key={photo.id}
            className="relative block aspect-[4/3] overflow-hidden border border-[#c9cacd]"
          >
            <img src={photo.url} alt="" className="size-full object-cover" />
            {photo.number === null ? null : (
              <span
                data-testid="print-photo-badge"
                className="absolute left-[2px] top-[2px] grid size-[15px] place-items-center rounded-full bg-[#ed1c24] font-mono text-[8.5px] font-bold text-white"
              >
                {photo.number}
              </span>
            )}
          </span>
        ))}
      </div>

      {model.photoOverflowText === null ? null : (
        <p className="mt-[5px] text-[9.5px] text-[#54555b]">{model.photoOverflowText}</p>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Mount both in the sheet**

In `intake-print-sheet.tsx`, replace the two `{/* Task 3 … */}` comments with:

```tsx
        <IntakePrintDamages model={model} />

        <IntakePrintPhotos model={model} />
```

and add the two imports.

- [ ] **Step 7: Run the tests and watch them pass**

Run: `pnpm --filter internal-web test -- intake-print-sheet`
Expected: PASS (11 tests).

- [ ] **Step 8: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src/features/intake-orders/print packages/i18n/src/messages
git commit -m "feat(intake): the printed order carries the drawing, the defects and the photographs that prove them"
```

---

## Task 4: The preview, and a print that waits for its photographs

**Files:**

- Create: `apps/internal-web/src/features/intake-orders/print/intake-print-dialog.tsx`
- Create: `apps/internal-web/src/features/intake-orders/print/intake-print.css`
- Create: `apps/internal-web/src/features/intake-orders/print/__tests__/intake-print-dialog.test.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/detail/intake-detail-header.tsx`
- Modify: `apps/internal-web/src/features/intake-orders/detail/__tests__/intake-detail-header.test.tsx`
- Modify: `packages/i18n/src/messages/sr.json` + `en.json`

**Interfaces:**

- Consumes: `IntakePrintSheet` (Task 2/3).
- Produces: `IntakePrintDialog({ order, open, onClose }: { order: IntakeOrderDetail; open: boolean; onClose: () => void }): ReactElement | null`.
- The header keeps its existing props and adds nothing: it owns the `open` state locally, the way it already owns `confirmRemove` and `confirmPickup`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/intake-print-dialog.test.tsx`:

```tsx
import { getLocale, m } from '@mr/i18n'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { intakeOrderDetailFixture, intakePhotoFixture, renderDetailUi } from '../../detail/__tests__/render-detail.js'
import { IntakePrintDialog } from '../intake-print-dialog.js'

describe('IntakePrintDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws nothing while it is closed', async () => {
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open={false} onClose={() => {}} />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('prints on demand once it is open', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.intake_detail_print() }))

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
  })

  it('will not print while a photograph is still loading', async () => {
    // `window.print()` does not wait for images. Fired early it prints six empty frames — and the
    // customer signs a page whose evidence is missing.
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const order = intakeOrderDetailFixture({
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444' })],
    })

    await renderDetailUi(<IntakePrintDialog order={order} open onClose={() => {}} />)

    expect(screen.getByRole('button', { name: m.intake_detail_print() })).toBeDisabled()

    fireEvent.load(screen.getByRole('img', { hidden: true }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: m.intake_detail_print() })).toBeEnabled(),
    )
  })

  it('lets a photograph that fails to load through, rather than locking the button forever', async () => {
    const order = intakeOrderDetailFixture({
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444' })],
    })

    await renderDetailUi(<IntakePrintDialog order={order} open onClose={() => {}} />)

    fireEvent.error(screen.getByRole('img', { hidden: true }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: m.intake_detail_print() })).toBeEnabled(),
    )
  })

  it('prints the language the operator picked, not the one the app is in', async () => {
    // A foreign customer brings the car in. The office keeps working in Serbian; the paper he
    // signs must be English, and choosing that must not change the app around it.
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    expect(screen.getByText(m.intake_print_title({}, { locale: 'sr' }))).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'en' }))

    expect(screen.getByText(m.intake_print_title({}, { locale: 'en' }))).toBeDefined()
    expect(screen.queryByText(m.intake_print_title({}, { locale: 'sr' }))).toBeNull()
    // The app's own chrome is untouched — `getLocale()` never moved.
    expect(getLocale()).toBe('sr')
  })

  it('closes on the close button and on Escape', async () => {
    const onClose = vi.fn()

    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={onClose} />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.action_close() }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
```

⚠️ The sheet's `<img>` elements carry `alt=""`, so Testing Library treats them as presentational — query them with `{ hidden: true }` as above, or give the print image a `data-testid` and query that. Pick one and keep it consistent with what Task 3 actually rendered.

And in `detail/__tests__/intake-detail-header.test.tsx`:

```tsx
it('opens the print preview instead of standing there disabled', async () => {
  await renderDetailUi(<IntakeDetailHeader order={intakeOrderDetailFixture()} {...NO_PERMS} />)

  const button = screen.getByRole('button', { name: m.intake_detail_print() })
  expect(button).toBeEnabled()

  fireEvent.click(button)

  expect(screen.getByRole('dialog')).toBeDefined()
})

it('offers no print on an unfinished intake — there is nothing signed to hand over', async () => {
  await renderDetailUi(<IntakeDetailHeader order={intakeDraftFixture()} {...NO_PERMS} />)

  expect(screen.queryByRole('button', { name: m.intake_detail_print() })).toBeNull()
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter internal-web test -- intake-print-dialog intake-detail-header`
Expected: FAIL — no dialog module; the header's print button is disabled and always rendered.

- [ ] **Step 3: Add the strings**

`sr.json`: `"intake_print_preview": "PREGLED ŠTAMPE · A4 · {type}"`, `"intake_print_waiting": "Učitavanje fotografija…"`, `"intake_print_language": "Jezik naloga"`.
`en.json`: `"intake_print_preview": "PRINT PREVIEW · A4 · {type}"`, `"intake_print_waiting": "Loading photos…"`, `"intake_print_language": "Work order language"`.

⚠️ These three are the preview's own chrome, so they follow the **app's** language (bare `m.*`) —
only the sheet inside follows the chosen one. The `sr` / `en` segment labels are the codes
themselves and are not translated.

⚠️ **Delete** `intake_detail_print_unavailable` from both files — it is the sentence that says this feature does not exist yet. Grep for it first; the header is its only consumer.

Then: `pnpm --filter @mr/i18n build`

- [ ] **Step 4: Write the print CSS**

Create `intake-print.css`. This is the house pattern already proven in
`features/claim-reports/claim-report-content-view.scss:23`:

```css
/*
 * Print only the sheet. `visibility`, not `display`: hiding ancestors with `display: none` would
 * take the sheet down with them, while `visibility: hidden` leaves the box tree standing so the
 * sheet can be made visible again inside it.
 */
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  body * {
    visibility: hidden;
  }

  #intake-print-sheet,
  #intake-print-sheet * {
    visibility: visible;
  }

  #intake-print-sheet {
    position: absolute;
    left: 0;
    top: 0;
    margin: 0;
    box-shadow: none;
  }
}
```

- [ ] **Step 5: Write the dialog**

Create `intake-print-dialog.tsx`:

```tsx
import { getLocale, m } from '@mr/i18n'
import type { IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useEffect, useState, type ReactElement } from 'react'

import { INTAKE_VEHICLE_TYPE_LABELS } from '../intake-labels'
import { PRINT_MAX_PHOTOS, type IntakePrintLocale } from './intake-print-data'
import { IntakePrintSheet } from './intake-print-sheet'
import './intake-print.css'

/**
 * The preview, at the paper's real size, with the only two ways out. Its own overlay rather than
 * the shared `ConfirmDialog`: a Radix dialog portals its content under a positioned, scroll-locked
 * wrapper, and the print stylesheet would then have to undo all of it. The photo lightbox next
 * door is built the same way for the same reason.
 *
 * The print button waits for every thumbnail. `window.print()` does not: fired while the images
 * are still arriving it prints empty frames onto the page the customer is about to sign.
 */
export function IntakePrintDialog({
  order,
  open,
  onClose,
}: {
  order: IntakeOrderDetail
  open: boolean
  onClose: () => void
}): ReactElement | null {
  const expected = Math.min(order.photos.length, PRINT_MAX_PHOTOS)
  const [settled, setSettled] = useState(0)
  /**
   * Defaults to the office's own language and is then the operator's to change — a foreign
   * customer signs an English work order while the app around it stays Serbian. Switching it
   * resets the image gate, because the sheet remounts and the thumbnails load again.
   */
  const [printLocale, setPrintLocale] = useState<IntakePrintLocale>(() =>
    getLocale() === 'en' ? 'en' : 'sr',
  )

  useEffect(() => {
    if (!open) {
      setSettled(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const ready = settled >= expected

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={m.intake_print_preview({
        type: INTAKE_VEHICLE_TYPE_LABELS[order.vehicleType](),
      })}
      className="fixed inset-0 z-50 flex flex-col items-center overflow-auto bg-[rgba(11,11,13,0.92)] p-6"
    >
      <div className="mb-[14px] flex w-[794px] flex-none items-center gap-3">
        <span className="font-mono text-[10.5px] font-semibold tracking-[0.18em] text-white">
          {m.intake_print_preview({ type: INTAKE_VEHICLE_TYPE_LABELS[order.vehicleType]() })}
        </span>
        {ready ? null : (
          <span className="font-mono text-[10.5px] text-[#b9babd]">{m.intake_print_waiting()}</span>
        )}

        {/* The paper's language, not the app's. Two segments rather than a dialog before the
            preview: the operator SEES what he is about to hand over. */}
        <div
          role="group"
          aria-label={m.intake_print_language()}
          className="flex overflow-hidden rounded-[9px] border border-white/25"
        >
          {(['sr', 'en'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={printLocale === value}
              onClick={() => {
                setPrintLocale(value)
                setSettled(0)
              }}
              className={cn(
                'h-[42px] w-[52px] cursor-pointer font-mono text-[12px] font-bold uppercase',
                printLocale === value ? 'bg-white text-[#141417]' : 'bg-transparent text-white',
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto h-[42px] cursor-pointer rounded-[9px] border border-white/25 bg-white/10 px-5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-white"
        >
          {m.action_close()}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => window.print()}
          className="h-[42px] cursor-pointer rounded-[9px] bg-[#f2f2f3] px-[22px] text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-[#141417] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {m.intake_detail_print()}
        </button>
      </div>

      <div
        className="flex-none shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
        onLoad={() => setSettled((count) => count + 1)}
        onError={() => setSettled((count) => count + 1)}
      >
        <IntakePrintSheet key={printLocale} order={order} locale={printLocale} />
      </div>
    </div>
  )
}
```

⚠️ `onLoad`/`onError` are put on the WRAPPER on purpose: `load` and `error` do not bubble in the DOM, but React's synthetic system does propagate them, so one pair of handlers counts every thumbnail without threading a callback through three components. If a future React version changes that, the fallback is an `onLoad` on each `<img>` in `intake-print-photos.tsx`.

- [ ] **Step 6: Wire the header button**

In `intake-detail-header.tsx`: add `const [printOpen, setPrintOpen] = useState(false)`, render the print button **only on a signed order** (`order.signedAt !== null` — a draft has nothing signed to hand over), drop `disabled`, `aria-describedby`, the `title` wrapper and the `PRINT_REASON_ID` block entirely, and render `<IntakePrintDialog order={order} open={printOpen} onClose={() => setPrintOpen(false)} />` beside the other dialogs.

```tsx
{order.signedAt === null ? null : (
  <InternalButton
    type="button"
    variant="outline"
    onClick={() => setPrintOpen(true)}
    className={ACTION_CLASSES}
  >
    {m.intake_detail_print()}
  </InternalButton>
)}
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `pnpm --filter internal-web test`
Expected: PASS — including the existing header tests, which never asserted the button was disabled.

- [ ] **Step 8: Full gate, then commit**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add apps/internal-web/src packages/i18n/src/messages
git commit -m "feat(intake): the work order prints, and it waits for its photographs before it does"
```

---

## Task 5: Measure the paper, then hand it over

jsdom has no pagination, no printer and no colour management. Everything that actually matters about a printed page is measured here or not at all.

**Files:**

- Modify: `docs/25-vehicle-service-intake-design.md`, `.superpowers/sdd/2026-07-29-intake-detail-v6/progress.md`

- [ ] **Step 1: Mutation-test the rules**

Break each line, run the named suite, confirm the named test — not merely *a* test — goes red, then restore it.

| Break | Expect red |
|---|---|
| `checklistRow` returns `'✗'` for `null` | "prints an untouched checklist row as a dash, never as 'no'" |
| `damages` slices at 20 instead of `PRINT_MAX_DAMAGES` | "cuts the defect list at twelve and says how many were left out" |
| `numberOf` searches `order.damages` instead of the truncated `damages` | "drops the badge of a photo whose defect did not make the page" |
| `markers` maps `order.damages` instead of `damages` | "cuts the defect list at twelve…" (marker count assertion) |
| `clipRemarks` returns the untrimmed value | "clips a long owner remark and marks the clip" |
| `silhouette` returns `INTAKE_SILHOUETTES[IntakeVehicleType.Car]` | "takes the silhouette from the order vehicle type, not from a default" |
| the dialog's `ready` is hard-coded `true` | "will not print while a photograph is still loading" |

⚠️ A mutation that leaves everything green is a finding — report it, do not paper over it.

- [ ] **Step 2: Print the fullest order you can build**

In the browser, on a signed order carrying **9 photos, 12+ defects, 6 services, 6 materials and a
300-character owner remark** (build it by editing an existing order through the V-6-2 amend mode,
or ask Nikola for one), open the preview and print to PDF. Check, in this order:

1. **Exactly one page.** Two pages is a failure of Task 1's rules, not of the CSS — say which rule.
2. Header band prints **black with the white logo**; section bands print **red** (this is what
   `print-color-adjust: exact` buys; without it they come out white and the page falls apart).
3. Silhouette matches the vehicle type; the markers' numbers match the list rows and the photo
   badges — pick defect ③ and follow it through all three.
4. Photographs are actually there — not six empty frames.
5. Signatures are sharp at 100% zoom (vector, not raster) and sit on their line.
6. The amendment box appears on an amended order with the neutral sentence, and is **absent**
   — with no reserved gap — on a clean one.
7. `⌘P` from the preview and "Save as PDF" give the same page.

- [ ] **Step 3: Print the empty order too**

A signed order with no defects, no photos, no services, no materials, no remark and no address:
the page must still be one page, still show "Nema uočenih nedostataka pri prijemu.", and the
footer must still sit at the bottom rather than floating under the last block.

- [ ] **Step 4: Check the app is not printable by accident**

With the preview **closed**, `⌘P` on the detail must not produce a mangled screenshot of the app —
it prints the app as it always did. The print CSS only takes over when the sheet is in the DOM.

- [ ] **Step 5: Reconcile the docs**

`docs/25` §3.5 currently describes the print as unbuilt and names the old marker caption. Rewrite it
to what exists: the neutral marker (decision ⑩), the black/red bands (decision ⑨), one page, the
truncation order, and that the print is client-side `window.print()` — deliberately NOT the server
Chromium renderer, whose memory is 93% of the hosting bill and which this page does not need.

- [ ] **Step 6: Write the state down**

Append a block to `.superpowers/sdd/2026-07-29-intake-detail-v6/progress.md` in the established
shape: what shipped, what each measurement found, and what is left.

- [ ] **Step 7: Full gate, commit, push**

```bash
pnpm format:check && pnpm exec turbo run build typecheck lint test --force --concurrency=4 \
  && pnpm --filter api depcruise && pnpm test:integration
git add docs .superpowers
git commit -m "docs(intake): the printed work order is measured, and the design says what was built"
git push origin feat/vehicle-intake
```

⚠️ Push only if the gate is green with `--force` and nothing above is half-built.

---

## Open questions — answer before Task 2, they change strings only

1. ~~Which language does the paper print in?~~ **Answered 2026-08-10:** both, and it is chosen at
   print time — a foreigner may bring a car in. The preview carries an `SR` / `EN` segment, the
   sheet renders in the chosen language through Paraglide's per-call `{ locale }`, and the app's
   own language never moves. Built into Tasks 1–4 above.
2. **The round "MADE IN SERBIA" emblem** that "Obaveze kupca" carries beside the wordmark is not in
   the repo, and neither is the small emblem in its footer. This plan uses only
   `public/internal/logo-white.png`, which is. Hand over the files and both slots get filled.
