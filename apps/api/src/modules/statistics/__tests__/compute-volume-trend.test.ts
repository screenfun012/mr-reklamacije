import { StatisticsVolumeTrendDirection } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { computeVolumeTrend } from '../statistics.service.js'

describe('computeVolumeTrend', () => {
  it('returns stable when there is no data', () => {
    const trend = computeVolumeTrend([])

    expect(trend.direction).toBe(StatisticsVolumeTrendDirection.Stable)
    expect(trend.currentPeriodTotal).toBe(0)
    expect(trend.delta).toBe(0)
  })

  it('detects rising volume when recent 12 months exceed the prior 12', () => {
    const byMonth = Array.from({ length: 24 }, (_, index) => ({
      month: `2024-${String((index % 12) + 1).padStart(2, '0')}`,
      emotive: index < 12 ? 1 : 3,
      domace: 0,
      total: index < 12 ? 1 : 3,
    }))

    const trend = computeVolumeTrend(byMonth)

    expect(trend.direction).toBe(StatisticsVolumeTrendDirection.Rising)
    expect(trend.currentPeriodTotal).toBe(36)
    expect(trend.previousPeriodTotal).toBe(12)
    expect(trend.delta).toBe(24)
  })
})
