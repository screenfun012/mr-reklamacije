import type { EmotiveClaimListQuery } from '../schemas/emotive-claim.schema.js'

/** List filters for offset query; optional fields match unset API query params. */
export type EmotiveClaimsListFilters = Omit<
  EmotiveClaimListQuery,
  'page' | 'pageSize' | 'includeDeleted'
> & {
  includeDeleted?: boolean
}

function normalizeDateFilter(value: Date | undefined): Date | undefined {
  if (value === undefined) {
    return undefined
  }

  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`)
}

export function normalizeEmotiveClaimsListFilters(
  filters: EmotiveClaimsListFilters,
): EmotiveClaimsListFilters {
  return {
    ...filters,
    dateFrom: normalizeDateFilter(filters.dateFrom),
    dateTo: normalizeDateFilter(filters.dateTo),
  }
}
