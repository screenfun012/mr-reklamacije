import type { ClaimSortBy, ClaimSortDir } from '../schemas/claim-list.schema.js'
import { normalizeClaimsListFilters, type ClaimsListFilters } from './claims-filters.js'

export type ClaimsListSort = {
  sortBy?: ClaimSortBy
  sortDir?: ClaimSortDir
}

function sortKeyFields(sort: ClaimsListSort): Partial<ClaimsListSort> {
  const fields: Partial<ClaimsListSort> = {}

  if (sort.sortBy !== undefined) {
    fields.sortBy = sort.sortBy
  }
  if (sort.sortDir !== undefined) {
    fields.sortDir = sort.sortDir
  }

  return fields
}

export const claimKeys = {
  all: ['claims'] as const,
  lists: () => [...claimKeys.all, 'list'] as const,
  list: (filters: ClaimsListFilters, page: number, pageSize: number, sort: ClaimsListSort = {}) =>
    [
      ...claimKeys.lists(),
      { ...normalizeClaimsListFilters(filters), page, pageSize, ...sortKeyFields(sort) },
    ] as const,
}
