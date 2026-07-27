import { IntakeArrivalMode, IntakeDamageType, IntakeVehicleType } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  emptyIntakeWizardValues,
  newDamageId,
  step1Complete,
  toCreateInput,
  toUpdateInput,
  valuesFromOrder,
  type IntakeWizardValues,
} from '../intake-wizard-state'

function filledValues(overrides: Partial<IntakeWizardValues> = {}): IntakeWizardValues {
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
    const patch = toUpdateInput(filledValues({ vin: '', ownerAddress: '  ' }), 2)
    expect(patch.vin).toBeNull()
    expect(patch.ownerAddress).toBeNull()
  })

  it('carries the step the serviser reached, clamped to the five that exist', () => {
    expect(toUpdateInput(filledValues(), 2).draftStep).toBe(2)
    expect(toUpdateInput(filledValues(), 0).draftStep).toBe(1)
    expect(toUpdateInput(filledValues(), 9).draftStep).toBe(5)
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
      damages: [],
      services: [],
      materials: [],
      draftStep: 3,
      technicianSignature: null,
      ownerSignature: null,
      signedAt: null,
      amendedAt: null,
      amendedByName: null,
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
    const patch = toUpdateInput(filledValues({ damages: [damage, second] }), 3)

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
