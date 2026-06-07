import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type {
  EmotiveClaimListQuery,
  EmotiveClaimListResponse,
} from '../schemas/emotive-claim.schema.js'
import { emotiveClaimKeys } from './emotive-claim-keys.js'
import {
  normalizeEmotiveClaimsListFilters,
  type EmotiveClaimsListFilters,
} from './emotive-claims-filters.js'
import { serializeEmotiveClaimsListParams } from './serialize-search-params.js'

export type { EmotiveClaimsListFilters } from './emotive-claims-filters.js'
export { normalizeEmotiveClaimsListFilters } from './emotive-claims-filters.js'

const EMOTIVE_CLAIMS_STALE_MS = 30_000

export function emotiveClaimsListQueryKey(
  filters: EmotiveClaimsListFilters,
  page: number,
  pageSize: EmotiveClaimsPageSize,
): ReturnType<typeof emotiveClaimKeys.list> {
  return emotiveClaimKeys.list(filters, page, pageSize)
}

export type EmotiveClaimsPageSize = 10 | 25 | 50

export function emotiveClaimsListOptions(
  filters: EmotiveClaimsListFilters,
  page: number,
  pageSize: EmotiveClaimsPageSize,
) {
  const normalized = normalizeEmotiveClaimsListFilters(filters)

  return queryOptions({
    queryKey: emotiveClaimKeys.list(normalized, page, pageSize),
    queryFn: async () => {
      const query = serializeEmotiveClaimsListParams({
        ...normalized,
        page,
        pageSize,
      } satisfies Partial<EmotiveClaimListQuery>)
      return fetchJson<EmotiveClaimListResponse>(`/api/emotive-claims?${query}`)
    },
    staleTime: EMOTIVE_CLAIMS_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
