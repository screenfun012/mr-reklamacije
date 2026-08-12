import { IntakeArrivalMode, IntakeOwnerType, IntakeDamageType, IntakeVehicleType } from '@mr/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearIntakeDraft,
  emptyIntakeWizardValues,
  INTAKE_DRAFT_MAX_AGE_MS,
  INTAKE_WIZARD_STEP_COUNT,
  INTAKE_DRAFT_STORAGE_KEY,
  newDamageId,
  readIntakeDraft,
  ownerIdentityComplete,
  step1Complete,
  toCreateInput,
  toUpdateInput,
  valuesFromOrder,
  writeIntakeDraft,
  type IntakeWizardValues,
} from '../intake-wizard-state'

/** Two of the shop's checklist items — enough to tell "a row per catalog item" from "the eight". */
const CATALOG = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'rezervna',
    nameSr: 'Rezervna guma',
    nameEn: 'Spare tyre',
    sortOrder: 10,
    isActive: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    code: 'dizalica',
    nameSr: 'Dizalica',
    nameEn: 'Jack',
    sortOrder: 20,
    isActive: true,
  },
]

function filledValues(overrides: Partial<IntakeWizardValues> = {}): IntakeWizardValues {
  return {
    ...emptyIntakeWizardValues(),
    orderNumber: 'RN-0249/26',
    plate: 'BG 774-LN',
    vehicle: 'Renault Master',
    ownerName: 'Milan Petrović',
    // A private person must show an ID card, so a "filled" step 1 now carries one.
    ownerIdNumber: '008123456',
    ownerPhone: '+381 60 111 2233',
    ...overrides,
  }
}

describe('step1Complete', () => {
  it('requires the order number as well as the four fields the form marks', () => {
    expect(step1Complete(filledValues())).toBe(true)
    expect(step1Complete(filledValues({ orderNumber: '   ' }))).toBe(false)
    expect(step1Complete(filledValues({ plate: '' }))).toBe(false)
    expect(step1Complete(filledValues({ vehicle: '' }))).toBe(false)
    expect(step1Complete(filledValues({ ownerName: '' }))).toBe(false)
    expect(step1Complete(filledValues({ ownerPhone: '' }))).toBe(false)
  })

  it('does not accept a one-character plate, which is always a slip', () => {
    expect(step1Complete(filledValues({ plate: 'B' }))).toBe(false)
  })

  it('holds a private person without an ID card, and lets a firm through without one', () => {
    // A firm has no ID card, so demanding one would stop an intake over a document that does not
    // exist. Its tax number is offered in the same field and is optional (spec ②③).
    expect(step1Complete(filledValues({ ownerIdNumber: '' }))).toBe(false)
    expect(step1Complete(filledValues({ ownerIdNumber: '   ' }))).toBe(false)
    expect(
      step1Complete(filledValues({ ownerType: IntakeOwnerType.Company, ownerIdNumber: '' })),
    ).toBe(true)
  })

  it('does not ask for an email, ever', () => {
    // Empty means the owner leaves with paper only — Nikola's rule, and the reason this is not a
    // required field anywhere.
    expect(step1Complete(filledValues({ ownerEmail: '' }))).toBe(true)
  })
})

describe('the owner type and the number under it', () => {
  it('clears the number when the type changes, so an ID card never becomes a tax number', () => {
    // The lock the single column needs. Without it a number typed a moment ago is silently
    // relabelled on a document that is evidence (spec ⑤).
    const values = filledValues({ ownerIdNumber: '008123456' })

    expect(ownerIdentityComplete(values)).toBe(true)
    expect(ownerIdentityComplete({ ...values, ownerIdNumber: '' })).toBe(false)
    expect(
      ownerIdentityComplete({ ...values, ownerType: IntakeOwnerType.Company, ownerIdNumber: '' }),
    ).toBe(true)
  })

  it('sends the type and the number to the server, and an empty number as null', () => {
    const patch = toUpdateInput(filledValues({ ownerIdNumber: '  ' }), 1, CATALOG)

    expect(patch.ownerType).toBe(IntakeOwnerType.Person)
    expect(patch.ownerIdNumber).toBeNull()
    expect(patch.ownerEmail).toBeNull()
  })
})

describe('toCreateInput', () => {
  it('omits empty optionals rather than sending empty strings', () => {
    const input = toCreateInput(filledValues())
    expect(input).not.toHaveProperty('vin')
    expect(input).not.toHaveProperty('mileage')
    expect(input).not.toHaveProperty('ownerAddress')
    expect(input).not.toHaveProperty('ownerRemarks')
  })

  it('trims what the serviser typed and keeps the chosen enums', () => {
    const input = toCreateInput(
      filledValues({
        orderNumber: '  RN-0249/26 ',
        plate: ' BG 774-LN ',
        vehicleType: IntakeVehicleType.Van,
        arrivalMode: IntakeArrivalMode.Towed,
      }),
    )
    expect(input.orderNumber).toBe('RN-0249/26')
    expect(input.plate).toBe('BG 774-LN')
    expect(input.vehicleType).toBe(IntakeVehicleType.Van)
    expect(input.arrivalMode).toBe(IntakeArrivalMode.Towed)
  })

  it('reads a mileage typed with spaces or dots as a number', () => {
    expect(toCreateInput(filledValues({ mileage: '214 300' })).mileage).toBe(214300)
    expect(toCreateInput(filledValues({ mileage: '214.300' })).mileage).toBe(214300)
    expect(toCreateInput(filledValues({ mileage: 'abc' })).mileage).toBeUndefined()
  })
})

describe('toUpdateInput', () => {
  it('clears an emptied optional with null instead of leaving the old value behind', () => {
    const patch = toUpdateInput(filledValues({ vin: '', ownerAddress: '  ' }), 2, CATALOG)
    expect(patch.vin).toBeNull()
    expect(patch.ownerAddress).toBeNull()
  })

  /**
   * An item nobody ticked still has to be RECORDED, because that is what prints as `—`. A row simply
   * missing from the map prints as nothing at all, and the sheet the customer signs quietly loses a
   * line (docs/25 §4.4). What the serviser actually said always wins over the untouched row.
   */
  it('records a row for every item the catalog offers, ticked or not', () => {
    const patch = toUpdateInput(filledValues({ checklist: { dizalica: false } }), 2, CATALOG)

    expect(patch.checklist).toEqual({ rezervna: null, dizalica: false })
  })

  it('keeps a code the catalog no longer offers, because the order already recorded it', () => {
    // A draft resumed after the shop retired an item: dropping the row here would silently rewrite
    // what was recorded before (plan D3).
    const patch = toUpdateInput(filledValues({ checklist: { lanci: true } }), 2, CATALOG)

    expect(patch.checklist).toEqual({ rezervna: null, dizalica: null, lanci: true })
  })

  it('carries the step the serviser reached, clamped to the four that exist', () => {
    expect(toUpdateInput(filledValues(), 2, CATALOG).draftStep).toBe(2)
    expect(toUpdateInput(filledValues(), 0, CATALOG).draftStep).toBe(1)
    // Four since 2026-08-10: Specifikacija left the wizard, so the signatures are the last step.
    expect(toUpdateInput(filledValues(), 9, CATALOG).draftStep).toBe(INTAKE_WIZARD_STEP_COUNT)
    expect(INTAKE_WIZARD_STEP_COUNT).toBe(4)
  })
})

describe('valuesFromOrder', () => {
  it('rebuilds the form from a server order, so resuming on another tablet is not an empty form', () => {
    const values = valuesFromOrder({
      id: 'a',
      orderNumber: 'RN-0251/26',
      status: 'primljeno',
      receivedAt: '2026-07-26T09:00:00.000Z',
      technicianId: 'b',
      technicianName: 'Pera',
      vehicleType: IntakeVehicleType.Pickup,
      plate: 'NS 445-CD',
      vehicle: 'Iveco Daily',
      vin: null,
      mileage: null,
      arrivalMode: IntakeArrivalMode.Dragged,
      ownerName: 'Zorica',
      ownerAddress: null,
      ownerPhone: '+381 63 987 6543',
      ownerRemarks: null,
      fuelLevel: 3,
      checklist: emptyIntakeWizardValues().checklist,
      equipmentNote: null,
      extraChecklist: [],
      extraDamages: [],
      damages: [],
      services: [],
      materials: [],
      draftStep: 3,
      technicianSignature: null,
      ownerSignature: null,
      signedAt: null,
      photosPending: 0,
      photos: [],
      createdAt: '2026-07-26T09:00:00.000Z',
      updatedAt: '2026-07-26T09:00:00.000Z',
    })

    expect(values.plate).toBe('NS 445-CD')
    expect(values.fuelLevel).toBe(3)
    // Nullable server columns must become empty strings, or React logs a controlled-input warning
    // and the field renders "null".
    expect(values.vin).toBe('')
    expect(values.mileage).toBe('')
    expect(values.ownerRemarks).toBe('')
  })
})

describe('newDamageId', () => {
  /**
   * `crypto.randomUUID()` is gated to secure contexts and the tablet reaches the dev server over
   * plain http on the hall LAN, so it would throw exactly where this runs.
   */
  it('produces distinct ids that fit the wire schema, without needing a secure context', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newDamageId()))

    expect(ids.size).toBe(500)
    for (const id of ids) {
      expect(id.length).toBeGreaterThan(0)
      expect(id.length).toBeLessThanOrEqual(40)
    }
  })
})

describe('damages round trip', () => {
  const damage = {
    id: 'd1',
    type: IntakeDamageType.Scratch,
    x: 100,
    y: 200,
    zone: 'prednja leva strana',
  }

  it('sends the markers with the step patch, in the order that IS their numbering', () => {
    const second = { ...damage, id: 'd2', x: 240 }
    const patch = toUpdateInput(filledValues({ damages: [damage, second] }), 3, CATALOG)

    expect(patch.damages).toEqual([damage, second])
  })

  it('starts an intake with no markers rather than undefined, so the map can render at once', () => {
    expect(emptyIntakeWizardValues().damages).toEqual([])
  })

  it('copies the server markers instead of aliasing them, so a tap cannot mutate the query cache', () => {
    const order = {
      id: 'o1',
      orderNumber: 'RN-0249/26',
      vehicleType: IntakeVehicleType.Car,
      plate: 'NS 445-CD',
      vehicle: 'Opel Astra',
      vin: null,
      mileage: null,
      arrivalMode: IntakeArrivalMode.Driven,
      ownerName: 'Marija Simić',
      ownerAddress: null,
      ownerPhone: '+381 60 000 1111',
      ownerRemarks: null,
      fuelLevel: 3,
      checklist: emptyIntakeWizardValues().checklist,
      equipmentNote: null,
      extraChecklist: [],
      extraDamages: [],
      damages: [damage],
      services: ['Zamena ulja'],
      materials: [],
    }

    const values = valuesFromOrder(order as unknown as Parameters<typeof valuesFromOrder>[0])
    values.damages.push({ ...damage, id: 'd2' })
    values.services.push('Balansiranje')

    expect(order.damages).toHaveLength(1)
    expect(order.services).toHaveLength(1)
  })
})

/**
 * jsdom shares one localStorage across a whole file and `vitest.setup.ts` does not reset it, so
 * every case below has to clear the key itself or it reads the previous case's write.
 */
describe('the tablet draft buffer', () => {
  const SERVISER = 'marko@mrgroup.rs'
  const KOLEGA = 'jelena@mrgroup.rs'

  /** Bypasses `writeIntakeDraft` on purpose: these cases seed shapes the writer refuses to produce. */
  function seedRaw(draft: unknown): void {
    window.localStorage.setItem(INTAKE_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }

  /** Reads past the reader's guard, to tell "was not written" from "was written but not offered". */
  function storedRaw(): unknown {
    const raw = window.localStorage.getItem(INTAKE_DRAFT_STORAGE_KEY)
    return raw === null ? null : JSON.parse(raw)
  }

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('gives the shift a name Nikola would recognise: twelve hours', () => {
    // The one number he actually chose. Written in terms of the constant everywhere else, so
    // without this line the whole policy could be changed to an hour and every test would pass.
    expect(INTAKE_DRAFT_MAX_AGE_MS).toBe(12 * 60 * 60 * 1000)
  })

  it('does not offer back a draft that has no order number to name it by', () => {
    seedRaw({
      orderId: null,
      step: 1,
      values: emptyIntakeWizardValues(),
      savedAt: Date.now(),
      savedBy: SERVISER,
    })

    expect(readIntakeDraft(SERVISER)).toBeNull()
  })

  it('refuses to replace a real draft with the empty one the wizard builds on mount', () => {
    writeIntakeDraft({ orderId: null, step: 2, values: filledValues(), savedBy: SERVISER })

    // Exactly what the wizard's buffering effect passes on a fresh mount, before the serviser has
    // had a chance to answer the offer the read effect just put on screen.
    writeIntakeDraft({
      orderId: null,
      step: 1,
      values: emptyIntakeWizardValues(),
      savedBy: SERVISER,
    })

    expect(readIntakeDraft(SERVISER)?.values.orderNumber).toBe('RN-0249/26')
    expect(readIntakeDraft(SERVISER)?.step).toBe(2)
  })

  it('keeps buffering while the intake is still worth resuming', () => {
    writeIntakeDraft({ orderId: null, step: 1, values: filledValues(), savedBy: SERVISER })
    writeIntakeDraft({ orderId: 'order-1', step: 3, values: filledValues(), savedBy: SERVISER })

    expect(readIntakeDraft(SERVISER)?.step).toBe(3)
    expect(readIntakeDraft(SERVISER)?.orderId).toBe('order-1')
  })

  it('keeps buffering when the number is blanked but the server already holds the intake', () => {
    writeIntakeDraft({ orderId: 'order-1', step: 3, values: filledValues(), savedBy: SERVISER })
    writeIntakeDraft({
      orderId: 'order-1',
      step: 3,
      values: filledValues({ orderNumber: '', equipmentNote: 'gepek prazan' }),
      savedBy: SERVISER,
    })

    // Written — so the intake keeps being tracked while he retypes the number...
    expect(storedRaw()).toMatchObject({ values: { equipmentNote: 'gepek prazan' } })
    // ...but not offerable, because the offer has nothing to name the intake by.
    expect(readIntakeDraft(SERVISER)).toBeNull()
  })

  it.each([
    ['a null values object', { values: null, savedAt: Date.now(), savedBy: SERVISER }],
    ['a values object with no order number', { values: {}, savedAt: Date.now() }],
    ['an array', []],
    ['a bare string', 'nedovrsen prijem'],
  ])('treats %s as no draft at all rather than throwing', (_label, stored) => {
    seedRaw(stored)

    expect(() => readIntakeDraft(SERVISER)).not.toThrow()
    expect(readIntakeDraft(SERVISER)).toBeNull()
  })

  it('forgets a draft the serviser explicitly waved away', () => {
    writeIntakeDraft({ orderId: null, step: 1, values: filledValues(), savedBy: SERVISER })

    clearIntakeDraft()

    expect(readIntakeDraft(SERVISER)).toBeNull()
    expect(storedRaw()).toBeNull()
  })

  describe('on a tablet two serviseri share', () => {
    it("does not show one serviser the other's customer", () => {
      writeIntakeDraft({ orderId: null, step: 2, values: filledValues(), savedBy: SERVISER })

      expect(readIntakeDraft(KOLEGA)).toBeNull()
    })

    it("leaves the other's draft where it is — it may be his only copy", () => {
      writeIntakeDraft({ orderId: null, step: 2, values: filledValues(), savedBy: SERVISER })

      readIntakeDraft(KOLEGA)

      expect(readIntakeDraft(SERVISER)?.values.orderNumber).toBe('RN-0249/26')
    })

    it('offers nothing at all before the session has a name to compare against', () => {
      writeIntakeDraft({ orderId: null, step: 2, values: filledValues(), savedBy: SERVISER })

      expect(readIntakeDraft('')).toBeNull()
      expect(storedRaw()).not.toBeNull()
    })

    it('does not treat two unnamed sessions as the same person', () => {
      // A draft stored before the session resolved carries no owner. Matching it against an equally
      // unnamed reader would hand a customer to whoever happens to be holding the tablet — the
      // "nobody equals nobody" hole that an equality check alone cannot see.
      writeIntakeDraft({ orderId: null, step: 2, values: filledValues(), savedBy: '' })

      expect(readIntakeDraft('')).toBeNull()
    })
  })

  describe('after a shift has passed', () => {
    const SHIFT_START = new Date('2026-08-04T07:30:00.000Z')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(SHIFT_START)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('still offers a draft from earlier in the same shift', () => {
      writeIntakeDraft({ orderId: null, step: 2, values: filledValues(), savedBy: SERVISER })

      vi.advanceTimersByTime(INTAKE_DRAFT_MAX_AGE_MS - 60_000)

      expect(readIntakeDraft(SERVISER)?.values.orderNumber).toBe('RN-0249/26')
    })

    it('stops offering a draft older than a shift', () => {
      writeIntakeDraft({ orderId: null, step: 2, values: filledValues(), savedBy: SERVISER })

      vi.advanceTimersByTime(INTAKE_DRAFT_MAX_AGE_MS + 60_000)

      expect(readIntakeDraft(SERVISER)).toBeNull()
    })

    it('throws the expired draft away instead of leaving a customer on a shared tablet', () => {
      writeIntakeDraft({ orderId: null, step: 2, values: filledValues(), savedBy: SERVISER })

      vi.advanceTimersByTime(INTAKE_DRAFT_MAX_AGE_MS + 60_000)
      readIntakeDraft(SERVISER)

      // Name, phone, address and plate: dead weight the moment the draft stops being offerable.
      expect(storedRaw()).toBeNull()
    })

    it('refuses a stamp from the future rather than trusting it forever', () => {
      // A tablet whose clock ran ahead and was then corrected. One-sided arithmetic makes the age
      // negative, and negative is always "within the window" — the draft would never expire.
      seedRaw({
        orderId: null,
        step: 2,
        values: filledValues(),
        savedAt: SHIFT_START.getTime() + INTAKE_DRAFT_MAX_AGE_MS + 60_000,
        savedBy: SERVISER,
      })

      expect(readIntakeDraft(SERVISER)).toBeNull()
    })

    it.each([
      // These three are refused by the freshness arithmetic itself — `NaN <= x` is false — so they
      // pin the POSITIVE phrasing of that comparison, not the type assertion.
      ['missing', undefined],
      ['a date string', '2026-08-04T07:30:00.000Z'],
      ['NaN', Number.NaN],
      // The one shape the type assertion earns its place against through this route: it survives
      // the arithmetic, and localStorage is writable by whoever holds the tablet.
      ['the right instant written as a string', String(SHIFT_START.getTime())],
    ])('refuses a draft whose age is %s', (_label, savedAt) => {
      seedRaw({ orderId: null, step: 2, values: filledValues(), savedAt, savedBy: SERVISER })

      expect(readIntakeDraft(SERVISER)).toBeNull()
    })

    it('refuses an age that overflows to Infinity', () => {
      // Hand-built JSON, not `seedRaw`: `JSON.stringify(Infinity)` is `null`, so going through the
      // helper would seed a different shape and the case would pass without ever testing this one.
      // `JSON.parse` has no such limit — `1e999` comes back as `Infinity`, which survives the
      // subtraction (`Date.now() - Infinity` is `-Infinity`, comfortably "within the window").
      const stored = JSON.stringify({
        orderId: null,
        step: 2,
        values: filledValues(),
        savedBy: SERVISER,
      }).replace(/}$/, ',"savedAt":1e999}')
      window.localStorage.setItem(INTAKE_DRAFT_STORAGE_KEY, stored)
      expect(JSON.parse(stored).savedAt).toBe(Number.POSITIVE_INFINITY)

      expect(readIntakeDraft(SERVISER)).toBeNull()
    })
  })
})
