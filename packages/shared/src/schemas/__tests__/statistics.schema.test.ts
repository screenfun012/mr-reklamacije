import { describe, expect, it } from 'vitest'

import {
  STATISTICS_MANUFACTURER_OTHERS_CODE,
  STATISTICS_UNKNOWN_MANUFACTURER_CODE,
} from '../../constants/statistics-manufacturer-colors.js'
import { StatisticsSummarySchema, StatisticsVolumeTrendDirection } from '../statistics.schema.js'

describe('StatisticsSummarySchema', () => {
  it('parses a valid trends summary', () => {
    const parsed = StatisticsSummarySchema.parse({
      trends: {
        byMonth: [{ month: '2025-06', emotive: 3, domace: 2, total: 5 }],
        byYear: [{ year: 2025, emotive: 10, domace: 7, total: 17 }],
        volumeTrend: {
          direction: StatisticsVolumeTrendDirection.Rising,
          currentPeriodTotal: 12,
          previousPeriodTotal: 8,
          delta: 4,
          deltaPercent: 50,
        },
      },
      byManufacturer: {
        items: [
          {
            manufacturerId: '00000000-0000-4000-8000-000000000001',
            code: 'BMW',
            name: 'BMW',
            total: 5,
            pending: 1,
            accepted: 3,
            rejected: 1,
          },
          {
            manufacturerId: null,
            code: STATISTICS_UNKNOWN_MANUFACTURER_CODE,
            name: 'Nepoznato',
            total: 2,
            pending: 0,
            accepted: 1,
            rejected: 1,
          },
        ],
      },
    })

    expect(parsed.trends.byMonth).toHaveLength(1)
    expect(parsed.trends.volumeTrend.direction).toBe('rising')
    expect(parsed.byManufacturer.items[1]?.code).toBe(STATISTICS_UNKNOWN_MANUFACTURER_CODE)
  })

  it('parses catalog OSTALO separately from UI others roll-up code', () => {
    const parsed = StatisticsSummarySchema.parse({
      trends: {
        byMonth: [],
        byYear: [],
        volumeTrend: {
          direction: StatisticsVolumeTrendDirection.Stable,
          currentPeriodTotal: 0,
          previousPeriodTotal: 0,
          delta: 0,
          deltaPercent: null,
        },
      },
      byManufacturer: {
        items: [
          {
            manufacturerId: '00000000-0000-4000-8000-000000000099',
            code: 'OSTALO',
            name: 'Ostalo',
            total: 3,
            pending: 1,
            accepted: 1,
            rejected: 1,
          },
        ],
      },
    })

    expect(parsed.byManufacturer.items[0]?.code).toBe('OSTALO')
    expect(parsed.byManufacturer.items[0]?.code).not.toBe(STATISTICS_MANUFACTURER_OTHERS_CODE)
  })
})
