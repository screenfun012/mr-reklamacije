import type { ClaimKind } from '../enums.js'

/** Filters for statistics summary API; unset fields mean default rolling 24-month window. */
export interface StatisticsSummaryFilters {
  kind?: ClaimKind
  manufacturerId?: string
  year?: number
  dateFrom?: Date
  dateTo?: Date
}

function normalizeDateFilter(value: Date | undefined): Date | undefined {
  if (value === undefined) {
    return undefined
  }

  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`)
}

export function normalizeStatisticsSummaryFilters(
  filters: StatisticsSummaryFilters,
): StatisticsSummaryFilters {
  const normalized: StatisticsSummaryFilters = {}

  if (filters.kind !== undefined) {
    normalized.kind = filters.kind
  }
  if (filters.manufacturerId !== undefined) {
    normalized.manufacturerId = filters.manufacturerId
  }
  if (filters.year !== undefined) {
    normalized.year = filters.year
  }
  if (filters.dateFrom !== undefined) {
    const dateFrom = normalizeDateFilter(filters.dateFrom)
    if (dateFrom !== undefined) {
      normalized.dateFrom = dateFrom
    }
  }
  if (filters.dateTo !== undefined) {
    const dateTo = normalizeDateFilter(filters.dateTo)
    if (dateTo !== undefined) {
      normalized.dateTo = dateTo
    }
  }

  return normalized
}
