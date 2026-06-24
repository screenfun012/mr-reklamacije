import { describe, expect, it } from 'vitest'

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
    })

    expect(parsed.trends.byMonth).toHaveLength(1)
    expect(parsed.trends.volumeTrend.direction).toBe('rising')
  })
})
