import { describe, expect, it } from 'vitest'

import { ClaimKind } from '../../enums.js'
import { type StatisticsSummaryFilters } from '../statistics-filters.js'
import {
  StatisticsSearchSchema,
  serializeStatisticsSummaryParams,
  statisticsFiltersFromSearch,
  statisticsSearchFromFilters,
} from '../statistics-search.js'
import { statisticsKeys, statisticsSummaryQueryKeyFromSearch } from '../statistics.js'

const MANUFACTURER_ID = '11111111-1111-4111-8111-111111111111'

describe('StatisticsSearchSchema', () => {
  it('accepts empty search for default rolling period', () => {
    expect(StatisticsSearchSchema.parse({})).toEqual({})
  })

  it('accepts year, manufacturer, kind, and custom date range params', () => {
    expect(
      StatisticsSearchSchema.parse({
        year: 2025,
        manufacturerId: MANUFACTURER_ID,
        kind: ClaimKind.Emotive,
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
      }),
    ).toEqual({
      year: 2025,
      manufacturerId: MANUFACTURER_ID,
      kind: ClaimKind.Emotive,
      dateFrom: '2025-01-01',
      dateTo: '2025-06-30',
    })
  })

  it('rejects invalid manufacturerId values', () => {
    expect(() =>
      StatisticsSearchSchema.parse({
        manufacturerId: 'not-a-uuid',
      }),
    ).toThrow()
  })

  it('rejects invalid year values', () => {
    expect(() =>
      StatisticsSearchSchema.parse({
        year: 1999,
      }),
    ).toThrow()
  })

  it('rejects dateFrom after dateTo', () => {
    expect(() =>
      StatisticsSearchSchema.parse({
        dateFrom: '2025-06-01',
        dateTo: '2025-01-01',
      }),
    ).toThrow()
  })

  it('requires both dateFrom and dateTo when one is present', () => {
    expect(() =>
      StatisticsSearchSchema.parse({
        dateFrom: '2025-01-01',
      }),
    ).toThrow()
  })

  it('rejects custom ranges longer than 36 months', () => {
    expect(() =>
      StatisticsSearchSchema.parse({
        dateFrom: '2022-01-01',
        dateTo: '2025-06-01',
      }),
    ).toThrow()
  })

  /**
   * A field code is unique per CATEGORY, not across the shop — `pojava_kvara` exists under engine
   * overhaul AND under auto service. Without the category the pair names two different questions,
   * so the schema refuses it rather than letting the server pick one.
   */
  it('refuses an answer filter without a category, and needs both halves of the answer', () => {
    expect(() =>
      StatisticsSearchSchema.parse({ fieldCode: 'sklop_u_kvaru', optionCode: 'glava' }),
    ).toThrow()
    expect(() =>
      StatisticsSearchSchema.parse({ categoryCode: 'REMONT_MOTORA', fieldCode: 'sklop_u_kvaru' }),
    ).toThrow()
    expect(() =>
      StatisticsSearchSchema.parse({ categoryCode: 'REMONT_MOTORA', optionCode: 'glava' }),
    ).toThrow()
    expect(
      StatisticsSearchSchema.parse({
        categoryCode: 'REMONT_MOTORA',
        fieldCode: 'sklop_u_kvaru',
        optionCode: 'glava',
      }).optionCode,
    ).toBe('glava')
  })
})

describe('statisticsFiltersFromSearch', () => {
  it('prefers custom date range over year in derived API filters', () => {
    expect(
      statisticsFiltersFromSearch(
        StatisticsSearchSchema.parse({
          year: 2024,
          dateFrom: '2025-01-01',
          dateTo: '2025-03-31',
        }),
      ),
    ).toEqual({
      dateFrom: new Date('2025-01-01T00:00:00.000Z'),
      dateTo: new Date('2025-03-31T00:00:00.000Z'),
    })
  })

  it('maps year-only search to year filter', () => {
    expect(
      statisticsFiltersFromSearch(
        StatisticsSearchSchema.parse({
          year: 2025,
          kind: ClaimKind.Domace,
        }),
      ),
    ).toEqual({
      year: 2025,
      kind: ClaimKind.Domace,
    })
  })
})

describe('statisticsSearchFromFilters', () => {
  it('round-trips filters through search params', () => {
    const filters: StatisticsSummaryFilters = {
      kind: ClaimKind.Emotive,
      manufacturerId: MANUFACTURER_ID,
      year: 2025,
    }

    expect(statisticsSearchFromFilters(filters)).toEqual({
      kind: ClaimKind.Emotive,
      manufacturerId: MANUFACTURER_ID,
      year: 2025,
    })

    expect(statisticsFiltersFromSearch(statisticsSearchFromFilters(filters))).toEqual(filters)
  })

  it('round-trips the answer filter with its category', () => {
    const filters: StatisticsSummaryFilters = {
      categoryCode: 'REMONT_MOTORA',
      fieldCode: 'sklop_u_kvaru',
      optionCode: 'glava',
    }

    expect(statisticsSearchFromFilters(filters)).toEqual({
      categoryCode: 'REMONT_MOTORA',
      fieldCode: 'sklop_u_kvaru',
      optionCode: 'glava',
    })

    expect(statisticsFiltersFromSearch(statisticsSearchFromFilters(filters))).toEqual(filters)
  })

  it('round-trips custom date range filters', () => {
    const filters: StatisticsSummaryFilters = {
      dateFrom: new Date('2025-02-01T00:00:00.000Z'),
      dateTo: new Date('2025-04-30T00:00:00.000Z'),
    }

    expect(statisticsSearchFromFilters(filters)).toEqual({
      dateFrom: '2025-02-01',
      dateTo: '2025-04-30',
    })

    expect(statisticsFiltersFromSearch(statisticsSearchFromFilters(filters))).toEqual(filters)
  })
})

describe('serializeStatisticsSummaryParams', () => {
  it('serializes only set filter fields', () => {
    const query = serializeStatisticsSummaryParams({
      year: 2025,
      manufacturerId: MANUFACTURER_ID,
      kind: ClaimKind.Domace,
    })

    const params = new URLSearchParams(query)
    expect(params.get('year')).toBe('2025')
    expect(params.get('manufacturerId')).toBe(MANUFACTURER_ID)
    expect(params.get('kind')).toBe(ClaimKind.Domace)
  })

  it('serializes the answer filter alongside its category', () => {
    const params = new URLSearchParams(
      serializeStatisticsSummaryParams({
        categoryCode: 'REMONT_MOTORA',
        fieldCode: 'sklop_u_kvaru',
        optionCode: 'glava',
      }),
    )

    expect(params.get('categoryCode')).toBe('REMONT_MOTORA')
    expect(params.get('fieldCode')).toBe('sklop_u_kvaru')
    expect(params.get('optionCode')).toBe('glava')
  })

  it('returns empty string for default rolling filters', () => {
    expect(serializeStatisticsSummaryParams({})).toBe('')
  })
})

describe('statisticsSummaryQueryKeyFromSearch', () => {
  it('uses default summary key for empty search', () => {
    expect(statisticsSummaryQueryKeyFromSearch({})).toEqual(statisticsKeys.summary({}))
  })

  it('changes query key when filters change', () => {
    const defaultKey = statisticsSummaryQueryKeyFromSearch({})
    const yearKey = statisticsSummaryQueryKeyFromSearch({ year: 2025 })
    const manufacturerKey = statisticsSummaryQueryKeyFromSearch({
      manufacturerId: MANUFACTURER_ID,
    })

    expect(defaultKey).not.toEqual(yearKey)
    expect(yearKey).not.toEqual(manufacturerKey)
  })
})
