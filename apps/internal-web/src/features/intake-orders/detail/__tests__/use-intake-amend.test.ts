import { IntakeDamageType } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { intakeAmendBufferFrom, intakeAmendDiff, isAmendPhoneValid } from '../use-intake-amend.js'
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

    expect(
      intakeAmendDiff({ ...intakeAmendBufferFrom(order), equipmentNote: '   ' }, order),
    ).toEqual({ equipmentNote: null })
    expect(intakeAmendDiff(intakeAmendBufferFrom(order), order)).toEqual({})
  })

  it('does not send an untouched empty note back as null', () => {
    // `null` on the wire and `''` in the buffer are the same absence — sending it would stamp a
    // permanent mark on a document where nobody typed anything.
    const order = intakeOrderDetailFixture({ equipmentNote: null })

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

  it('sends the fuel level only when the dial moved', () => {
    const order = intakeOrderDetailFixture({ fuelLevel: 3 })
    const buffer = intakeAmendBufferFrom(order)

    expect(intakeAmendDiff(buffer, order)).toEqual({})
    expect(intakeAmendDiff({ ...buffer, fuelLevel: 4 }, order)).toEqual({ fuelLevel: 4 })
  })

  it('sends the damages when a marker is removed', () => {
    const damage = {
      id: 'd1',
      type: IntakeDamageType.Scratch,
      x: 100,
      y: 60,
      zone: 'Prednja leva',
    }
    const order = intakeOrderDetailFixture({ damages: [damage] })

    expect(intakeAmendDiff({ ...intakeAmendBufferFrom(order), damages: [] }, order)).toEqual({
      damages: [],
    })
  })

  it('sends every changed key at once, and nothing else', () => {
    const order = intakeOrderDetailFixture({ fuelLevel: 3, equipmentNote: null })
    const buffer = {
      ...intakeAmendBufferFrom(order),
      ownerPhone: '+381 64 111 2233',
      fuelLevel: 5,
    }

    expect(intakeAmendDiff(buffer, order)).toEqual({
      ownerPhone: '+381 64 111 2233',
      fuelLevel: 5,
    })
  })
})

describe('isAmendPhoneValid', () => {
  it('refuses an emptied phone, which the wire schema requires', () => {
    expect(isAmendPhoneValid('  ')).toBe(false)
    expect(isAmendPhoneValid('12')).toBe(false)
  })

  it('accepts what the wire accepts', () => {
    expect(isAmendPhoneValid('+381 64 111 2233')).toBe(true)
    expect(isAmendPhoneValid(`  ${'9'.repeat(40)}  `)).toBe(true)
    expect(isAmendPhoneValid('9'.repeat(41))).toBe(false)
  })
})
