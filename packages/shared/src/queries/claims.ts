import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { ClaimListQuery, ClaimListResponse } from '../schemas/claim-list.schema.js'
import { claimKeys } from './claim-keys.js'
import { normalizeClaimsListFilters, type ClaimsListFilters } from './claims-filters.js'
import { serializeEmotiveClaimsListParams } from './serialize-search-params.js'

export type { ClaimsListFilters } from './claims-filters.js'
export { normalizeClaimsListFilters } from './claims-filters.js'

const CLAIMS_LIST_STALE_MS = 30_000

export type ClaimsPageSize = 10 | 25 | 50

export function claimsListQueryKey(
  filters: ClaimsListFilters,
  page: number,
  pageSize: ClaimsPageSize,
): ReturnType<typeof claimKeys.list> {
  return claimKeys.list(filters, page, pageSize)
}

export function claimsListOptions(
  filters: ClaimsListFilters,
  page: number,
  pageSize: ClaimsPageSize,
) {
  const normalized = normalizeClaimsListFilters(filters)

  return queryOptions({
    queryKey: claimKeys.list(normalized, page, pageSize),
    queryFn: async () => {
      const query = serializeEmotiveClaimsListParams({
        ...normalized,
        page,
        pageSize,
      } satisfies Partial<ClaimListQuery>)
      return fetchJson<ClaimListResponse>(`/api/claims?${query}`)
    },
    staleTime: CLAIMS_LIST_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
