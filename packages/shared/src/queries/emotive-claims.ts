import { infiniteQueryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type {
  EmotiveClaimListQuery,
  EmotiveClaimListResponse,
} from '../schemas/emotive-claim.schema.js'
import { serializeEmotiveClaimsListParams } from './serialize-search-params.js'

/** List filters for infinite query; optional fields match unset API query params. */
export type EmotiveClaimsListFilters = Omit<
  EmotiveClaimListQuery,
  'cursor' | 'includeDeleted' | 'limit'
> & {
  includeDeleted?: boolean
  limit?: number
}

const EMOTIVE_CLAIMS_STALE_MS = 30_000

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

export function emotiveClaimsListQueryKey(
  filters: EmotiveClaimsListFilters,
): readonly ['emotive-claims', EmotiveClaimsListFilters] {
  return ['emotive-claims', normalizeEmotiveClaimsListFilters(filters)] as const
}

export function emotiveClaimsListNextCursor(
  lastPage: EmotiveClaimListResponse,
): string | undefined {
  return lastPage.nextCursor ?? undefined
}

export function emotiveClaimsListOptions(filters: EmotiveClaimsListFilters) {
  const normalized = normalizeEmotiveClaimsListFilters(filters)

  return infiniteQueryOptions({
    queryKey: emotiveClaimsListQueryKey(normalized),
    queryFn: async ({ pageParam }) => {
      const query = serializeEmotiveClaimsListParams({ limit: 50, ...normalized }, pageParam)
      return fetchJson<EmotiveClaimListResponse>(`/api/emotive-claims?${query}`)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: emotiveClaimsListNextCursor,
    staleTime: EMOTIVE_CLAIMS_STALE_MS,
  })
}
