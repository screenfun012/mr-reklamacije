import { z } from 'zod'

import { ClaimKind } from '../enums.js'
import {
  normalizeStatisticsSummaryFilters,
  type StatisticsSummaryFilters,
} from './statistics-filters.js'

const claimKindValues = [ClaimKind.Emotive, ClaimKind.Domace] as const

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

const STATISTICS_MAX_CUSTOM_RANGE_MONTHS = 36

export const StatisticsSearchSchema = z
  .object({
    kind: z.enum(claimKindValues).optional(),
    manufacturerId: z.string().uuid().optional(),
    categoryCode: z.string().trim().min(1).optional(),
    fieldCode: z.string().trim().min(1).optional(),
    optionCode: z.string().trim().min(1).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    dateFrom: z.string().regex(isoDatePattern).optional(),
    dateTo: z.string().regex(isoDatePattern).optional(),
  })
  .superRefine((data, ctx) => {
    const hasAnswer = data.fieldCode !== undefined || data.optionCode !== undefined
    if (
      hasAnswer &&
      (data.fieldCode === undefined ||
        data.optionCode === undefined ||
        data.categoryCode === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        // A field code is unique per category, not across the shop: `pojava_kvara` exists under
        // engine overhaul AND under auto service. Without the category it names two questions.
        message: 'fieldCode and optionCode require categoryCode',
        path: ['fieldCode'],
      })
    }

    const hasFrom = data.dateFrom !== undefined
    const hasTo = data.dateTo !== undefined

    if (hasFrom !== hasTo) {
      ctx.addIssue({
        code: 'custom',
        message: 'dateFrom and dateTo must both be set',
        path: hasFrom ? ['dateTo'] : ['dateFrom'],
      })
      return
    }

    if (!hasFrom || !hasTo || data.dateFrom === undefined || data.dateTo === undefined) {
      return
    }

    if (data.dateFrom > data.dateTo) {
      ctx.addIssue({
        code: 'custom',
        message: 'dateFrom must be on or before dateTo',
        path: ['dateFrom'],
      })
      return
    }

    const monthSpan = countInclusiveMonths(data.dateFrom, data.dateTo)
    if (monthSpan > STATISTICS_MAX_CUSTOM_RANGE_MONTHS) {
      ctx.addIssue({
        code: 'custom',
        message: `Custom date range must not exceed ${STATISTICS_MAX_CUSTOM_RANGE_MONTHS} months`,
        path: ['dateTo'],
      })
    }
  })

export type StatisticsSearch = z.infer<typeof StatisticsSearchSchema>

function parseIsoDate(value: string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined
  }

  return new Date(`${value}T00:00:00.000Z`)
}

function countInclusiveMonths(dateFrom: string, dateTo: string): number {
  const from = parseIsoDate(dateFrom)
  const to = parseIsoDate(dateTo)

  if (from === undefined || to === undefined) {
    return 0
  }

  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) + 1
  )
}

export function statisticsFiltersFromSearch(search: StatisticsSearch): StatisticsSummaryFilters {
  const hasCustomRange = search.dateFrom !== undefined && search.dateTo !== undefined
  const filters: StatisticsSummaryFilters = {}

  if (search.kind !== undefined) {
    filters.kind = search.kind
  }
  if (search.manufacturerId !== undefined) {
    filters.manufacturerId = search.manufacturerId
  }
  if (search.categoryCode !== undefined) {
    filters.categoryCode = search.categoryCode
  }
  if (search.fieldCode !== undefined) {
    filters.fieldCode = search.fieldCode
  }
  if (search.optionCode !== undefined) {
    filters.optionCode = search.optionCode
  }

  if (hasCustomRange && search.dateFrom !== undefined && search.dateTo !== undefined) {
    const dateFrom = parseIsoDate(search.dateFrom)
    const dateTo = parseIsoDate(search.dateTo)
    if (dateFrom !== undefined) {
      filters.dateFrom = dateFrom
    }
    if (dateTo !== undefined) {
      filters.dateTo = dateTo
    }
  } else if (search.year !== undefined) {
    filters.year = search.year
  }

  return normalizeStatisticsSummaryFilters(filters)
}

export function statisticsSearchFromFilters(filters: StatisticsSummaryFilters): StatisticsSearch {
  const normalized = normalizeStatisticsSummaryFilters(filters)
  const search: StatisticsSearch = {}

  if (normalized.kind !== undefined) {
    search.kind = normalized.kind
  }
  if (normalized.manufacturerId !== undefined) {
    search.manufacturerId = normalized.manufacturerId
  }
  if (normalized.categoryCode !== undefined) {
    search.categoryCode = normalized.categoryCode
  }
  if (normalized.fieldCode !== undefined) {
    search.fieldCode = normalized.fieldCode
  }
  if (normalized.optionCode !== undefined) {
    search.optionCode = normalized.optionCode
  }
  if (normalized.dateFrom !== undefined && normalized.dateTo !== undefined) {
    search.dateFrom = normalized.dateFrom.toISOString().slice(0, 10)
    search.dateTo = normalized.dateTo.toISOString().slice(0, 10)
  } else if (normalized.year !== undefined) {
    search.year = normalized.year
  }

  return search
}

export { serializeStatisticsSummaryParams } from './serialize-statistics-params.js'
