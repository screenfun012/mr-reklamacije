import { m, setLocale } from '@mr/i18n'
import { IntakeDamageType, IntakeVehicleType } from '@mr/shared'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  intakeOrderDetailFixture,
  intakePhotoFixture,
} from '../../detail/__tests__/render-detail.js'
import { buildIntakePrintModel, PRINT_MAX_DAMAGES } from '../intake-print-data.js'

function damage(n: number) {
  return {
    id: `d${n}`,
    type: IntakeDamageType.Scratch,
    x: 100 + n,
    y: 60 + n,
    zone: `Zona ${n}`,
  }
}

function photo(n: number, damageId: string | null) {
  return intakePhotoFixture({ id: `4444444${n}-4444-4444-8444-444444444444`, damageId })
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
    expect(model.markers.map((marker) => marker.number)).toEqual([1, 2, 3])
    // The circle sits on the marker, the digit 6px below its centre (prototype :1388).
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

  it('still counts the photographs, which is all the paper says about them now', () => {
    // The thumbnails left the document on 2026-08-10; the count is what stayed, in the figures row
    // and in the legal sentence the customer signs.
    const order = intakeOrderDetailFixture({
      photos: Array.from({ length: 9 }, (_, i) => photo(i, null)),
    })

    expect(buildIntakePrintModel(order, 'sr').photoCount).toBe(9)
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
      intakeOrderDetailFixture({ vehicleType: IntakeVehicleType.Van }),
      'sr',
    ).silhouette

    expect(van).not.toEqual(car)
  })

  it('speaks the language it was asked for, not the one the app is in', () => {
    // The app is Serbian because that is what the office works in. A foreign customer still gets
    // an English paper, and choosing it must not move the app.
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

  it('dates the paper in the paper language, not the app one', () => {
    // An English work order with a Serbian long date is the same mistake in a smaller place.
    const order = intakeOrderDetailFixture()

    expect(buildIntakePrintModel(order, 'en').receivedAt).not.toBe(
      buildIntakePrintModel(order, 'sr').receivedAt,
    )
  })
})
