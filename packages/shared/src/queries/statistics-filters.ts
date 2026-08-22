import type { ClaimKind } from '../enums.js'

/** Filters for statistics summary API; unset fields mean default rolling 24-month window. */
export interface StatisticsSummaryFilters {
  kind?: ClaimKind
  manufacturerId?: string
  /** The category CODE, never its id — the same value the claims list carries in its URL. */
  categoryCode?: string
  /**
   * One answer to one category field — the whole of the cross-tab. Both halves are CODES, and
   * both are meaningless without `categoryCode`: a field code is unique per category, not across
   * the shop (`pojava_kvara` exists under engine overhaul AND under auto service).
   */
  fieldCode?: string
  optionCode?: string
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
  if (filters.categoryCode !== undefined) {
    normalized.categoryCode = filters.categoryCode
  }
  if (filters.fieldCode !== undefined) {
    normalized.fieldCode = filters.fieldCode
  }
  if (filters.optionCode !== undefined) {
    normalized.optionCode = filters.optionCode
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
