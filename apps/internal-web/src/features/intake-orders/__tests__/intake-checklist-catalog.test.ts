import { describe, expect, it } from 'vitest'

import {
  resolveIntakeChecklistRows,
  untouchedIntakeChecklist,
} from '../intake-checklist-catalog.js'

const catalog = [
  {
    id: 'a',
    code: 'rezervna',
    nameSr: 'Rezervna guma',
    nameEn: 'Spare tyre',
    sortOrder: 10,
    isActive: true,
  },
  {
    id: 'b',
    code: 'lanci',
    nameSr: 'Lanci / alat',
    nameEn: 'Chains / tools',
    sortOrder: 80,
    isActive: false,
  },
  /**
   * The item the office added THIS MORNING. It has to be in this fixture, and no order below records
   * it: with a catalog that holds only the codes the orders hold, iterating the catalog instead of the
   * order gives the identical answer and the D4 case below passes while proving nothing (measured —
   * that mutation left it green).
   */
  {
    id: 'c',
    code: 'patosnici',
    nameSr: 'Gumeni patosnici',
    nameEn: 'Rubber mats',
    sortOrder: 90,
    isActive: true,
  },
]

describe('resolveIntakeChecklistRows', () => {
  it("renders the ORDER's own keys, not what the catalog offers today", () => {
    // The order recorded two rows. A ninth item added to the catalog since must not appear here,
    // or an old "3 / 8" silently becomes "3 / 9" for a document the customer already signed (D4).
    const rows = resolveIntakeChecklistRows({ rezervna: true, lanci: null }, catalog, 'sr')

    expect(rows.map((row) => row.code)).toEqual(['rezervna', 'lanci'])
    expect(rows).toHaveLength(2)
  })

  it('keeps a deactivated item readable, because a signed order holds its code', () => {
    const rows = resolveIntakeChecklistRows({ lanci: false }, catalog, 'sr')

    expect(rows[0]?.name).toBe('Lanci / alat')
  })

  it('falls back to the bare code when the catalog has no row at all', () => {
    // Never drop the row: it is a line the customer signed for (D3).
    const rows = resolveIntakeChecklistRows({ nepoznato: true }, catalog, 'sr')

    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('nepoznato')
  })

  it('picks the English name for the English sheet', () => {
    const rows = resolveIntakeChecklistRows({ rezervna: true }, catalog, 'en')

    expect(rows[0]?.name).toBe('Spare tyre')
  })

  it('orders rows by the catalog sort order, with unknown codes last', () => {
    const rows = resolveIntakeChecklistRows(
      { zzz: true, lanci: null, rezervna: false },
      catalog,
      'sr',
    )

    expect(rows.map((row) => row.code)).toEqual(['rezervna', 'lanci', 'zzz'])
  })

  it('carries the recorded value through, including the untouched third state', () => {
    const rows = resolveIntakeChecklistRows({ rezervna: null, lanci: false }, catalog, 'sr')

    expect(rows.map((row) => row.value)).toEqual([null, false])
  })
})

describe('untouchedIntakeChecklist', () => {
  /**
   * What an order RECORDS for a row nobody ticked. It has to be IN the map: a row that is simply
   * missing prints as nothing at all, and the sheet would silently drop a line the customer signed
   * for — where an untouched row prints `—` (docs/25 §4.4).
   */
  it('gives every item the catalog offers an untouched row', () => {
    expect(untouchedIntakeChecklist(catalog)).toEqual({
      rezervna: null,
      lanci: null,
      patosnici: null,
    })
  })

  it('records nothing when the catalog is empty, rather than inventing rows', () => {
    expect(untouchedIntakeChecklist([])).toEqual({})
  })
})
