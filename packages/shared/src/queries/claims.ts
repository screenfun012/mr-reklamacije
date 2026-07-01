import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { ClaimListQuery, ClaimListResponse } from '../schemas/claim-list.schema.js'
import type { ClientClaimListResponse } from '../schemas/client-claim.schema.js'
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

/**
 * Client portal fetches its whole claim set in one page and paginates it
 * client-side. This is the ceiling; a client with more than this needs
 * server-side pagination (see CLAUDE.md drift note).
 */
export const CLIENT_CLAIMS_FETCH_PAGE_SIZE = 50 satisfies ClaimsPageSize

/**
 * Client-portal claims list. Same `/api/claims` endpoint, but typed as the
 * whitelisted `ClientClaimListResponse` so portal code cannot even reference
 * stripped fields (employee/faults/notes). The server enforces the strip +
 * row-level `own_customer` scope; this is the type-level half of that contract.
 */
export function clientClaimsListOptions(
  page = 1,
  pageSize: ClaimsPageSize = CLIENT_CLAIMS_FETCH_PAGE_SIZE,
) {
  return queryOptions({
    queryKey: ['claims', 'client-list', page, pageSize] as const,
    queryFn: async () =>
      fetchJson<ClientClaimListResponse>(`/api/claims?page=${page}&pageSize=${pageSize}`),
    staleTime: CLAIMS_LIST_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
