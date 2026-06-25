import { describe, expect, it } from 'vitest'

import {
  STATISTICS_OTHERS_CODE,
  STATISTICS_UNKNOWN_CODE,
} from '../../constants/statistics-rank-colors.js'
import {
  collapseRankRowsForDisplay,
  isStatisticsUnknownRankRow,
} from '../statistics-rank-display.js'

describe('isStatisticsUnknownRankRow', () => {
  it('detects unknown bucket code', () => {
    expect(isStatisticsUnknownRankRow({ code: STATISTICS_UNKNOWN_CODE })).toBe(true)
    expect(isStatisticsUnknownRankRow({ code: 'BMW' })).toBe(false)
  })
})

describe('collapseRankRowsForDisplay', () => {
  it('keeps top 10 known rows and rolls up the rest into others', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      code: `E${index + 1}`,
      name: `Radnik ${index + 1}`,
      total: 12 - index,
    }))

    const collapsed = collapseRankRowsForDisplay(items, 10)

    expect(collapsed).toHaveLength(11)
    expect(collapsed.slice(0, 10).every((entry) => entry.segment === 'known')).toBe(true)
    expect(collapsed[10]?.code).toBe(STATISTICS_OTHERS_CODE)
    expect(collapsed[10]?.total).toBe(3)
  })

  it('appends unknown segment separately at the end', () => {
    const collapsed = collapseRankRowsForDisplay([
      { code: 'SELMAN', name: 'Selman', total: 5 },
      { code: STATISTICS_UNKNOWN_CODE, name: 'Nepoznato', total: 2 },
    ])

    expect(collapsed).toHaveLength(2)
    expect(collapsed[1]?.segment).toBe('unknown')
    expect(collapsed[1]?.code).toBe(STATISTICS_UNKNOWN_CODE)
  })

  it('skips others roll-up when disabled', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      code: `S${index + 1}`,
      name: `Izvor ${index + 1}`,
      total: 12 - index,
    }))

    const collapsed = collapseRankRowsForDisplay(items, 10, { rollupOthers: false })

    expect(collapsed).toHaveLength(10)
    expect(collapsed.some((entry) => entry.code === STATISTICS_OTHERS_CODE)).toBe(false)
  })
})
