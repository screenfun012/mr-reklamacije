import { describe, expect, it } from 'vitest'

import {
  computeAcceptanceRatePercent,
  computeOutcomeDistributionPercents,
  formatStatisticsDays,
  hasProcessingTimeSample,
  roundStatisticsDays,
} from '../statistics-outcomes-display.js'

describe('computeOutcomeDistributionPercents', () => {
  it('returns rounded percentages for non-zero totals', () => {
    expect(
      computeOutcomeDistributionPercents({
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
      computeOutcomeDistributionPercents({
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

describe('computeAcceptanceRatePercent', () => {
  it('returns accepted share of decided claims', () => {
    expect(computeAcceptanceRatePercent(7, 10)).toBe(70)
  })

  it('returns null when no decided claims', () => {
    expect(computeAcceptanceRatePercent(0, 0)).toBeNull()
  })

  it('rounds to one decimal place', () => {
    expect(computeAcceptanceRatePercent(1, 3)).toBe(33.3)
  })
})

describe('roundStatisticsDays', () => {
  it('rounds to one decimal place', () => {
    expect(roundStatisticsDays(12.345)).toBe(12.3)
  })
})

describe('formatStatisticsDays', () => {
  it('formats numeric days', () => {
    expect(formatStatisticsDays(4.2)).toBe('4.2')
  })

  it('returns em dash for missing values', () => {
    expect(formatStatisticsDays(null)).toBe('—')
    expect(formatStatisticsDays(undefined)).toBe('—')
  })
})

describe('hasProcessingTimeSample', () => {
  it('detects non-empty samples', () => {
    expect(hasProcessingTimeSample({ sampleSize: 1 })).toBe(true)
    expect(hasProcessingTimeSample({ sampleSize: 0 })).toBe(false)
  })
})
