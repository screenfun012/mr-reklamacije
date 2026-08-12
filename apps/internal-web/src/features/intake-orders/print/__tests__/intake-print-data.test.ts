import { m, setLocale } from '@mr/i18n'
import { IntakeDamageType, IntakeVehicleType } from '@mr/shared'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  intakeChecklistCatalogFixture,
  intakeOrderDetailFixture,
  intakePhotoFixture,
} from '../../detail/__tests__/render-detail.js'
import {
  buildIntakePrintModel,
  PRINT_MAX_DAMAGES,
  PRINT_MAX_OTHER_DAMAGES,
} from '../intake-print-data.js'

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

/** The shop's list as the seed leaves it, `lanci` retired — the same catalog the screens read. */
const CATALOG = intakeChecklistCatalogFixture()

describe('buildIntakePrintModel', () => {
  beforeAll(() => {
    setLocale('sr', { reload: false })
  })

  it('carries the equipment note onto the sheet', () => {
    // Since 2026-08-12 the note on its own satisfies the rule that an intake must record SOMETHING,
    // so a note that stops at the screen would let a serviser hand over a sheet asserting nothing.
    const order = intakeOrderDetailFixture({ equipmentNote: 'Gepek pun alata' })

    expect(buildIntakePrintModel(order, CATALOG, 'sr').equipmentNote).toBe('Gepek pun alata')
  })

  it('keeps an empty note out of the model rather than printing a blank line', () => {
    const order = intakeOrderDetailFixture({ equipmentNote: '   ' })

    expect(buildIntakePrintModel(order, CATALOG, 'sr').equipmentNote).toBeNull()
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

    const marks = buildIntakePrintModel(order, CATALOG, 'sr').checklist.map((row) => row.mark)

    expect(marks[0]).toBe('✓')
    expect(marks[1]).toBe('✗')
    expect(marks[2]).toBe('—')
  })

  it('names the rows from the catalog, in the catalog order', () => {
    const rows = buildIntakePrintModel(intakeOrderDetailFixture(), CATALOG, 'sr').checklist

    expect(rows.map((row) => row.label)).toEqual([
      'Rezervna guma',
      'Dizalica',
      'Komplet dizalice',
      'Saobraćajna dozvola',
      'Vozačka dozvola',
      'Prva pomoć',
      'Prsluk i trougao',
      'Lanci / alat',
    ])
  })

  it('still names an item the shop has retired, because this order recorded it', () => {
    // `lanci` is inactive in the fixture catalog. The picker would not offer it for a new intake; a
    // sheet that already holds it must still print its name and not a bare code (plan D3).
    const rows = buildIntakePrintModel(intakeOrderDetailFixture(), CATALOG, 'sr').checklist

    expect(rows.at(-1)).toMatchObject({ key: 'lanci', label: 'Lanci / alat' })
  })

  it('prints a code the catalog no longer holds at all rather than dropping the line', () => {
    const catalog = CATALOG.filter((item) => item.code !== 'prsluk')

    const rows = buildIntakePrintModel(intakeOrderDetailFixture(), catalog, 'sr').checklist

    expect(rows).toHaveLength(8)
    expect(rows.map((row) => row.label)).toContain('prsluk')
  })

  it('prints the rows the order recorded, not the ones the catalog offers today', () => {
    // Nine items in the catalog, eight on this signed order. The ninth was added after it was
    // signed, and that sheet never had nine rows (plan D4).
    const catalog = [
      ...CATALOG,
      {
        id: '00000000-0000-4000-8000-000000000099',
        code: 'patosnici',
        nameSr: 'Gumeni patosnici',
        nameEn: 'Rubber mats',
        sortOrder: 90,
        isActive: true,
      },
    ]

    const rows = buildIntakePrintModel(intakeOrderDetailFixture(), catalog, 'sr').checklist

    expect(rows).toHaveLength(8)
    expect(rows.map((row) => row.key)).not.toContain('patosnici')
  })

  it('numbers defects from 1 in list order, and the markers carry the same numbers', () => {
    const order = intakeOrderDetailFixture({ damages: [damage(1), damage(2), damage(3)] })

    const model = buildIntakePrintModel(order, CATALOG, 'sr')

    expect(model.damages.map((d) => d.number)).toEqual([1, 2, 3])
    expect(model.markers.map((marker) => marker.number)).toEqual([1, 2, 3])
    // The circle sits on the marker, the digit 6px below its centre (prototype :1388).
    expect(model.markers[0]?.textY).toBe((model.markers[0]?.y ?? 0) + 6)
  })

  it('cuts the defect list at twelve and says how many were left out', () => {
    const order = intakeOrderDetailFixture({
      damages: Array.from({ length: 15 }, (_, i) => damage(i + 1)),
    })

    const model = buildIntakePrintModel(order, CATALOG, 'sr')

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

    expect(buildIntakePrintModel(order, CATALOG, 'sr').photoCount).toBe(9)
  })

  it('keeps five services and five materials', () => {
    const order = intakeOrderDetailFixture({
      services: ['a', 'b', 'c', 'd', 'e', 'f'],
      materials: ['1', '2', '3', '4', '5', '6', '7'],
    })

    const model = buildIntakePrintModel(order, CATALOG, 'sr')

    expect(model.services).toHaveLength(5)
    expect(model.materials).toHaveLength(5)
  })

  it('clips a long owner remark and marks the clip', () => {
    const order = intakeOrderDetailFixture({ ownerRemarks: 'x'.repeat(400) })

    const remarks = buildIntakePrintModel(order, CATALOG, 'sr').ownerRemarks

    expect(remarks.length).toBeLessThanOrEqual(181)
    expect(remarks.endsWith('…')).toBe(true)
  })

  it('says "no remarks" rather than leaving the field blank', () => {
    const order = intakeOrderDetailFixture({ ownerRemarks: null })

    expect(buildIntakePrintModel(order, CATALOG, 'sr').ownerRemarks.length).toBeGreaterThan(0)
  })

  it('takes the silhouette from the order vehicle type, not from a default', () => {
    const car = buildIntakePrintModel(intakeOrderDetailFixture(), CATALOG, 'sr').silhouette
    const van = buildIntakePrintModel(
      intakeOrderDetailFixture({ vehicleType: IntakeVehicleType.Van }),
      CATALOG,
      'sr',
    ).silhouette

    expect(van).not.toEqual(car)
  })

  it('speaks the language it was asked for, not the one the app is in', () => {
    // The app is Serbian because that is what the office works in. A foreign customer still gets
    // an English paper, and choosing it must not move the app.
    const order = intakeOrderDetailFixture({ ownerRemarks: null })

    expect(buildIntakePrintModel(order, CATALOG, 'sr').ownerRemarks).toBe(
      m.intake_print_no_remarks({}, { locale: 'sr' }),
    )
    expect(buildIntakePrintModel(order, CATALOG, 'en').ownerRemarks).toBe(
      m.intake_print_no_remarks({}, { locale: 'en' }),
    )
    expect(buildIntakePrintModel(order, CATALOG, 'en').ownerRemarks).not.toBe(
      buildIntakePrintModel(order, CATALOG, 'sr').ownerRemarks,
    )
  })

  it('translates the labels it resolves, not just the sentences', () => {
    const order = intakeOrderDetailFixture()

    const sr = buildIntakePrintModel(order, CATALOG, 'sr')
    const en = buildIntakePrintModel(order, CATALOG, 'en')

    expect(en.checklist[0]?.label).not.toBe(sr.checklist[0]?.label)
    expect(en.arrivalMode).not.toBe(sr.arrivalMode)
  })

  it('dates the paper in the paper language, not the app one', () => {
    // An English work order with a Serbian long date is the same mistake in a smaller place.
    const order = intakeOrderDetailFixture()

    expect(buildIntakePrintModel(order, CATALOG, 'en').receivedAt).not.toBe(
      buildIntakePrintModel(order, CATALOG, 'sr').receivedAt,
    )
  })

  it('never carries the added contact number onto the sheet', () => {
    const model = buildIntakePrintModel(
      intakeOrderDetailFixture({ ownerPhone: '+381 11 111', contactPhone: '+381 64 999' }),
      CATALOG,
      'sr',
    )

    // Positive control: proves the fixture override actually landed and the model is not simply
    // empty, so the absence assertion below means something.
    expect(JSON.stringify(model)).toContain('+381 11 111')
    // The paper is the signed record. The working note has no business on it (docs/25 §5).
    expect(JSON.stringify(model)).not.toContain('+381 64 999')
  })
})

/**
 * Rows the serviser wrote in because the shop's lists do not offer them. On paper they are not a
 * separate idea — an equipment row prints among the equipment, and a defect with no place on the
 * drawing gets its own sub-block because it has no number to print.
 */
describe('buildIntakePrintModel — the rows the serviser wrote in', () => {
  beforeAll(() => {
    setLocale('sr', { reload: false })
  })

  it('prints a written-in equipment row like any other, and an unanswered one as a dash', () => {
    const order = intakeOrderDetailFixture({
      checklist: {},
      extraChecklist: [
        { name: 'Gumeni patosnici', value: true },
        { name: 'Kanister', value: null },
      ],
    })

    const rows = buildIntakePrintModel(order, CATALOG, 'sr').checklist

    expect(rows.map((row) => [row.label, row.mark])).toEqual([
      ['Gumeni patosnici', '✓'],
      ['Kanister', '—'],
    ])
  })

  it('keeps the written-in rows after the catalog ones, the order the screens use', () => {
    const order = intakeOrderDetailFixture({
      checklist: { rezervna: true },
      extraChecklist: [{ name: 'Gumeni patosnici', value: false }],
    })

    const labels = buildIntakePrintModel(order, CATALOG, 'sr').checklist.map((row) => row.label)

    expect(labels[labels.length - 1]).toBe('Gumeni patosnici')
  })

  it('counts the unmarked defects in the printed figure', () => {
    // The figure is what the customer reads first. "1" over a list of three is a lie on evidence.
    const order = intakeOrderDetailFixture({ damages: [], extraDamages: ['felne izgrebane'] })

    expect(buildIntakePrintModel(order, CATALOG, 'sr').damageCount).toBe(1)
  })

  it('folds both overflows into one number, because the customer asks how many did not fit', () => {
    const order = intakeOrderDetailFixture({
      damages: Array.from({ length: PRINT_MAX_DAMAGES + 2 }, (_, i) => damage(i + 1)),
      extraDamages: Array.from({ length: PRINT_MAX_OTHER_DAMAGES + 3 }, (_, i) => `stavka ${i}`),
    })

    const model = buildIntakePrintModel(order, CATALOG, 'sr')

    // Two markers plus three written-in rows left off the page — one sentence, not two.
    expect(model.damagesOverflow).toBe(5)
    expect(model.otherDamages).toHaveLength(PRINT_MAX_OTHER_DAMAGES)
  })
})
