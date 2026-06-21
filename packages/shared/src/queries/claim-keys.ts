import { normalizeClaimsListFilters, type ClaimsListFilters } from './claims-filters.js'

export const claimKeys = {
  all: ['claims'] as const,
  lists: () => [...claimKeys.all, 'list'] as const,
  list: (filters: ClaimsListFilters, page: number, pageSize: number) =>
    [...claimKeys.lists(), { ...normalizeClaimsListFilters(filters), page, pageSize }] as const,
}
