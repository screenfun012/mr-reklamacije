import { describe, expect, it } from 'vitest'

import {
  resolveStatisticsRankColor,
  STATISTICS_OTHERS_CODE,
  STATISTICS_UNKNOWN_CODE,
} from '../statistics-rank-colors.js'
import { STATISTICS_SOURCE_FIXED_COLORS } from '../statistics-source-colors.js'

describe('STATISTICS_SOURCE_FIXED_COLORS', () => {
  it('maps all eight seeded source codes', () => {
    expect(Object.keys(STATISTICS_SOURCE_FIXED_COLORS).sort()).toEqual([
      'APPROVED_GREEN',
      'AUTO_STANIC',
      'HMT',
      'HR_GEO_SUPPORT',
      'HR_MIROSLAV_VUJIC',
      'JONKER',
      'SELMAN',
      'VITOBELLO',
    ])
  })
})

describe('resolveStatisticsRankColor for sources', () => {
  it('returns fixed color for SELMAN', () => {
    expect(
      resolveStatisticsRankColor('SELMAN', 0, {
        fixedColors: STATISTICS_SOURCE_FIXED_COLORS,
      }),
    ).toEqual(STATISTICS_SOURCE_FIXED_COLORS.SELMAN)
  })

  it('returns neutral gray for unknown bucket', () => {
    expect(
      resolveStatisticsRankColor(STATISTICS_UNKNOWN_CODE, 0, {
        fixedColors: STATISTICS_SOURCE_FIXED_COLORS,
      }).fill,
    ).toBe('var(--color-mr-neutral-400)')
  })

  it('returns darker neutral for others roll-up bucket', () => {
    expect(
      resolveStatisticsRankColor(STATISTICS_OTHERS_CODE, 0, {
        fixedColors: STATISTICS_SOURCE_FIXED_COLORS,
      }).fill,
    ).toBe('var(--color-mr-neutral-500)')
  })
})
