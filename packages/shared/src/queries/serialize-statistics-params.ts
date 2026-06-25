import type { StatisticsSummaryFilters } from './statistics-filters.js'
import { normalizeStatisticsSummaryFilters } from './statistics-filters.js'

function appendDateParam(params: URLSearchParams, key: string, value: Date | undefined): void {
  if (value === undefined) {
    return
  }

  params.set(key, value.toISOString().slice(0, 10))
}

export function serializeStatisticsSummaryParams(filters: StatisticsSummaryFilters): string {
  const normalized = normalizeStatisticsSummaryFilters(filters)
  const params = new URLSearchParams()

  if (normalized.kind !== undefined) {
    params.set('kind', normalized.kind)
  }
  if (normalized.manufacturerId !== undefined) {
    params.set('manufacturerId', normalized.manufacturerId)
  }
  if (normalized.year !== undefined) {
    params.set('year', String(normalized.year))
  }

  appendDateParam(params, 'dateFrom', normalized.dateFrom)
  appendDateParam(params, 'dateTo', normalized.dateTo)

  return params.toString()
}
