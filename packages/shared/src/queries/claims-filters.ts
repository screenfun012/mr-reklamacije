import type { ClaimListQuery } from '../schemas/claim-list.schema.js'

/** List filters for unified claims query; optional fields match unset API query params. */
export type ClaimsListFilters = Omit<
  ClaimListQuery,
  'page' | 'pageSize' | 'includeDeleted' | 'sortBy' | 'sortDir'
> & {
  includeDeleted?: boolean
}

function normalizeDateFilter(value: Date | undefined): Date | undefined {
  if (value === undefined) {
    return undefined
  }

  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`)
}

export function normalizeClaimsListFilters(filters: ClaimsListFilters): ClaimsListFilters {
  return {
    ...filters,
    dateFrom: normalizeDateFilter(filters.dateFrom),
    dateTo: normalizeDateFilter(filters.dateTo),
  }
}
