import { ClaimKind } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  StatisticsPeriodMode,
  buildStatisticsQueryContext,
  resolveEffectiveScope,
  resolveStatisticsPeriod,
} from '../statistics-claim-filter.js'

describe('resolveEffectiveScope', () => {
  const fullScope = { includeEmotive: true, includeDomace: true }

  it('limits scope to emotive when kind filter is emotive', () => {
    expect(resolveEffectiveScope(fullScope, { kind: ClaimKind.Emotive })).toEqual({
      includeEmotive: true,
      includeDomace: false,
    })
  })

  it('limits scope to domace when kind filter is domace', () => {
    expect(resolveEffectiveScope(fullScope, { kind: ClaimKind.Domace })).toEqual({
      includeEmotive: false,
      includeDomace: true,
    })
  })

  it('respects permission scope when kind filter is unset', () => {
    expect(resolveEffectiveScope({ includeEmotive: true, includeDomace: false }, {})).toEqual({
      includeEmotive: true,
      includeDomace: false,
    })
  })
})

describe('resolveStatisticsPeriod', () => {
  it('uses rolling 24-month mode by default', () => {
    expect(resolveStatisticsPeriod({}).mode).toBe(StatisticsPeriodMode.Rolling24)
  })

  it('uses year mode when year filter is set', () => {
    const period = resolveStatisticsPeriod({ year: 2025 })

    expect(period.mode).toBe(StatisticsPeriodMode.Year)
    expect(period.year).toBe(2025)
  })

  it('prefers custom range over year filter', () => {
    const period = resolveStatisticsPeriod({
      year: 2024,
      dateFrom: new Date('2025-01-01T00:00:00.000Z'),
      dateTo: new Date('2025-03-31T00:00:00.000Z'),
    })

    expect(period.mode).toBe(StatisticsPeriodMode.Custom)
    expect(period.dateFrom).toBe('2025-01-01')
    expect(period.dateTo).toBe('2025-03-31')
  })
})

describe('buildStatisticsQueryContext', () => {
  it('combines effective scope, period, and manufacturer filter', () => {
    const manufacturerId = '11111111-1111-4111-8111-111111111111'
    const ctx = buildStatisticsQueryContext(
      { includeEmotive: true, includeDomace: true },
      { kind: ClaimKind.Domace, manufacturerId, year: 2025 },
    )

    expect(ctx.effectiveScope).toEqual({ includeEmotive: false, includeDomace: true })
    expect(ctx.period.mode).toBe(StatisticsPeriodMode.Year)
    expect(ctx.manufacturerId).toBe(manufacturerId)
  })
})
