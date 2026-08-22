import { describe, expect, it } from 'vitest'

import {
  STATISTICS_OTHERS_CODE,
  STATISTICS_UNKNOWN_CODE,
} from '../../constants/statistics-rank-colors.js'
import type { StatisticsManufacturerRow } from '../../schemas/statistics.schema.js'
import {
  collapseManufacturerRowsForDisplay,
  computeManufacturerOutcomePercents,
  isStatisticsUnknownManufacturer,
} from '../statistics-manufacturer-display.js'

function row(
  overrides: Partial<StatisticsManufacturerRow> & Pick<StatisticsManufacturerRow, 'code' | 'total'>,
): StatisticsManufacturerRow {
  return {
    manufacturerId: overrides.manufacturerId ?? '00000000-0000-4000-8000-000000000001',
    name: overrides.name ?? overrides.code,
    pending: overrides.pending ?? 0,
    accepted: overrides.accepted ?? overrides.total,
    rejected: overrides.rejected ?? 0,
    ...overrides,
  }
}

describe('isStatisticsUnknownManufacturer', () => {
  it('detects null manufacturer id', () => {
    expect(
      isStatisticsUnknownManufacturer(
        row({ manufacturerId: null, code: STATISTICS_UNKNOWN_CODE, total: 2 }),
      ),
    ).toBe(true)
  })
})

describe('collapseManufacturerRowsForDisplay', () => {
  it('keeps top 10 known rows and rolls up the rest into others', () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      row({
        manufacturerId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        code: `M${index + 1}`,
        total: 12 - index,
      }),
    )

    const collapsed = collapseManufacturerRowsForDisplay(items, 10)

    expect(collapsed).toHaveLength(11)
    expect(collapsed.slice(0, 10).every((entry) => entry.segment === 'known')).toBe(true)
    expect(collapsed[10]?.code).toBe(STATISTICS_OTHERS_CODE)
    expect(collapsed[10]?.total).toBe(3)
  })

  it('appends unknown segment separately at the end', () => {
    const collapsed = collapseManufacturerRowsForDisplay([
      row({ code: 'BMW', total: 5 }),
      row({
        manufacturerId: null,
        code: STATISTICS_UNKNOWN_CODE,
        name: 'Nepoznato',
        total: 2,
        accepted: 1,
        pending: 1,
      }),
    ])

    expect(collapsed).toHaveLength(2)
    expect(collapsed[1]?.segment).toBe('unknown')
    expect(collapsed[1]?.code).toBe(STATISTICS_UNKNOWN_CODE)
  })

  it('does not merge catalog OSTALO into others roll-up', () => {
    const collapsed = collapseManufacturerRowsForDisplay([
      row({ code: 'OSTALO', name: 'Ostalo', total: 4 }),
      row({ code: 'BMW', total: 10 }),
    ])

    expect(collapsed.some((entry) => entry.code === 'OSTALO')).toBe(true)
    expect(collapsed.some((entry) => entry.code === STATISTICS_OTHERS_CODE)).toBe(false)
  })
})

describe('computeManufacturerOutcomePercents', () => {
  it('returns rounded percentages that sum to 100 for simple totals', () => {
    expect(
      computeManufacturerOutcomePercents({
        total: 10,
        pending: 2,
        accepted: 5,
        rejected: 3,
      }),
    ).toEqual({
      pendingPercent: 20,
      acceptedPercent: 50,
      rejectedPercent: 30,
    })
  })

  it('returns zeros when total is zero', () => {
    expect(
      computeManufacturerOutcomePercents({
        total: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
      }),
    ).toEqual({
      pendingPercent: 0,
      acceptedPercent: 0,
      rejectedPercent: 0,
    })
  })
})
