import {
  normalizeEmotiveClaimsListFilters,
  type EmotiveClaimsListFilters,
} from './emotive-claims-filters.js'

export const emotiveClaimKeys = {
  all: ['emotive-claims'] as const,
  lists: () => [...emotiveClaimKeys.all, 'list'] as const,
  list: (filters: EmotiveClaimsListFilters, page: number, pageSize: number) =>
    [
      ...emotiveClaimKeys.lists(),
      { ...normalizeEmotiveClaimsListFilters(filters), page, pageSize },
    ] as const,
  details: () => [...emotiveClaimKeys.all, 'detail'] as const,
  detail: (id: string) => [...emotiveClaimKeys.details(), id] as const,
}
