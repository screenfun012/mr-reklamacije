import { describe, expect, it } from 'vitest'

import {
  STATISTICS_FIELD_PREDATES_CODE,
  STATISTICS_FIELD_UNFILLED_CODE,
  STATISTICS_OTHERS_CODE,
  STATISTICS_UNKNOWN_CODE,
} from '../../constants/statistics-rank-colors.js'
import { StatisticsSummarySchema, StatisticsVolumeTrendDirection } from '../statistics.schema.js'

const emptyOutcomes = {
  distribution: { pending: 0, accepted: 0, rejected: 0, total: 0 },
  processingTime: { averageDays: null, medianDays: null, maxDays: 0, sampleSize: 0 },
  acceptanceRateByMonth: [],
}

const emptyBreakdowns = {
  byCategory: { items: [] },
  byEmployee: { items: [] },
  byEngineType: { items: [] },
  domaceAmounts: { totalAmount: 0, claimCount: 0 },
  byCustomer: { items: [] },
  byFaults: { byEmployee: [], byDepartment: [], byExternalParty: [] },
  byCategoryFields: [],
}

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
            code: STATISTICS_UNKNOWN_CODE,
            name: 'Nepoznato',
            total: 2,
            pending: 0,
            accepted: 1,
            rejected: 1,
          },
        ],
      },
      outcomes: {
        distribution: { pending: 3, accepted: 4, rejected: 2, total: 9 },
        processingTime: { averageDays: 12.5, medianDays: 10, maxDays: 45, sampleSize: 6 },
        acceptanceRateByMonth: [{ month: '2025-06', decided: 4, accepted: 3, ratePercent: 75 }],
      },
      byEmployee: {
        items: [
          {
            employeeId: '00000000-0000-4000-8000-000000000020',
            code: '00000000-0000-4000-8000-000000000020',
            name: 'Marko Marković',
            total: 6,
          },
        ],
      },
      byCategory: {
        items: [
          {
            categoryId: '00000000-0000-4000-8000-000000000040',
            code: 'REMONT_MOTORA',
            name: 'Generalni remont motora',
            total: 5,
            pending: 1,
            accepted: 3,
            rejected: 1,
          },
        ],
      },
      byEngineType: {
        items: [
          {
            engineTypeId: null,
            code: STATISTICS_UNKNOWN_CODE,
            name: 'Nepoznato',
            total: 1,
          },
        ],
      },
      domaceAmounts: { totalAmount: '3999.75', claimCount: 2 },
      byCustomer: {
        items: [
          {
            customerId: '00000000-0000-4000-8000-000000000030',
            code: '00000000-0000-4000-8000-000000000030',
            name: 'Auto Stanić',
            total: 4,
            pending: 1,
            accepted: 2,
            rejected: 1,
          },
        ],
      },
      byFaults: {
        byEmployee: [
          {
            id: '00000000-0000-4000-8000-000000000020',
            code: '00000000-0000-4000-8000-000000000020',
            name: 'Marko Marković',
            total: 2,
          },
        ],
        byDepartment: [],
        byExternalParty: [],
      },
      byCategoryFields: [],
    })

    expect(parsed.trends.byMonth).toHaveLength(1)
    expect(parsed.trends.volumeTrend.direction).toBe('rising')
    expect(parsed.byManufacturer.items[1]?.code).toBe(STATISTICS_UNKNOWN_CODE)
    expect(parsed.outcomes.processingTime.sampleSize).toBe(6)
    expect(parsed.byEmployee?.items[0]?.name).toBe('Marko Marković')
    expect(parsed.byCategory.items[0]?.name).toBe('Generalni remont motora')
    expect(parsed.byEngineType.items[0]?.code).toBe(STATISTICS_UNKNOWN_CODE)
    expect(parsed.domaceAmounts).toEqual({ totalAmount: 3999.75, claimCount: 2 })
    expect(parsed.byCustomer.items[0]?.name).toBe('Auto Stanić')
    expect(parsed.byFaults.byEmployee?.[0]?.total).toBe(2)
  })

  /**
   * The withheld shape is a real answer from the server, not an edge case: a reader without
   * `employees.view_analytics` gets `null` for both per-person sections and `null` for the money
   * without `statistics.view_financial`. If any of the three loses `.nullable()`, the client fails
   * to parse a response the API legitimately sends.
   */
  it('parses a summary with the withheld sections set to null', () => {
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
      byManufacturer: { items: [] },
      outcomes: emptyOutcomes,
      ...emptyBreakdowns,
      byEmployee: null,
      domaceAmounts: null,
      byFaults: { byEmployee: null, byDepartment: [], byExternalParty: [] },
    })

    expect(parsed.byEmployee).toBeNull()
    expect(parsed.domaceAmounts).toBeNull()
    expect(parsed.byFaults.byEmployee).toBeNull()
    // Not everything goes: what is not about a named person still parses as a list.
    expect(parsed.byFaults.byDepartment).toEqual([])
  })

  /**
   * The section is an array and never `null`: nothing about an answer to a category field is
   * withheld — it is not a named person and not money. The two synthetic buckets arrive with an
   * EMPTY name, because the server never writes a Serbian label for something that is not a row
   * in the catalogue; the client is what labels them.
   */
  it('parses the category-field section, with the two synthetic buckets unnamed', () => {
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
      byManufacturer: { items: [] },
      outcomes: emptyOutcomes,
      ...emptyBreakdowns,
      byCategoryFields: [
        {
          categoryCode: 'REMONT_MOTORA',
          categoryName: 'Generalni remont motora',
          total: 3,
          fields: [
            {
              fieldCode: 'sklop_u_kvaru',
              fieldName: 'Sklop u kvaru',
              isActive: true,
              items: [
                { code: 'glava', name: 'Glava', total: 1, isActive: true },
                { code: 'turbina', name: 'Turbina', total: 1, isActive: false },
                { code: STATISTICS_FIELD_UNFILLED_CODE, name: '', total: 1, isActive: true },
                { code: STATISTICS_FIELD_PREDATES_CODE, name: '', total: 0, isActive: true },
              ],
            },
          ],
        },
      ],
    })

    expect(parsed.byCategoryFields[0]?.total).toBe(3)
    expect(parsed.byCategoryFields[0]?.fields[0]?.items).toHaveLength(4)
    expect(parsed.byCategoryFields[0]?.fields[0]?.items[1]?.isActive).toBe(false)
    expect(parsed.byCategoryFields[0]?.fields[0]?.items[2]?.name).toBe('')
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
      outcomes: emptyOutcomes,
      ...emptyBreakdowns,
    })

    expect(parsed.byManufacturer.items[0]?.code).toBe('OSTALO')
    expect(parsed.byManufacturer.items[0]?.code).not.toBe(STATISTICS_OTHERS_CODE)
  })
})
