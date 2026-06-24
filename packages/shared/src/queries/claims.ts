import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { ClaimListQuery, ClaimListResponse } from '../schemas/claim-list.schema.js'
import { claimKeys, type ClaimsListSort } from './claim-keys.js'
import { normalizeClaimsListFilters, type ClaimsListFilters } from './claims-filters.js'
import { serializeEmotiveClaimsListParams } from './serialize-search-params.js'

export type { ClaimsListFilters } from './claims-filters.js'
export { normalizeClaimsListFilters } from './claims-filters.js'

const CLAIMS_LIST_STALE_MS = 30_000

export type ClaimsPageSize = 10 | 25 | 50

export type { ClaimsListSort } from './claim-keys.js'

export function claimsListQueryKey(
  filters: ClaimsListFilters,
  page: number,
  pageSize: ClaimsPageSize,
  sort: ClaimsListSort = {},
): ReturnType<typeof claimKeys.list> {
  return claimKeys.list(filters, page, pageSize, sort)
}

export function claimsListOptions(
  filters: ClaimsListFilters,
  page: number,
  pageSize: ClaimsPageSize,
  sort: ClaimsListSort = {},
) {
  const normalized = normalizeClaimsListFilters(filters)

  return queryOptions({
    queryKey: claimKeys.list(normalized, page, pageSize, sort),
    queryFn: async () => {
      const query = serializeEmotiveClaimsListParams({
        ...normalized,
        ...sort,
        page,
        pageSize,
      } satisfies Partial<ClaimListQuery>)
      return fetchJson<ClaimListResponse>(`/api/claims?${query}`)
    },
    staleTime: CLAIMS_LIST_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
