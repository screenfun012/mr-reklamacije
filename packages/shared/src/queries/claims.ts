import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { ClaimKind } from '../enums.js'
import type { ClaimListQuery, ClaimListResponse } from '../schemas/claim-list.schema.js'
import type { ClientClaimDetail, ClientClaimListResponse } from '../schemas/client-claim.schema.js'
import type { ClientPortalSummary } from '../schemas/client-portal.schema.js'
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

/** Portal dashboard shows a 2-column card grid; 10 cards per server page. */
export const CLIENT_CLAIMS_PAGE_SIZE = 10 satisfies ClaimsPageSize

/**
 * The one place client-portal query keys are defined — used by BOTH the
 * queryOptions below and the portal's SSE invalidation
 * (invalidateClientClaimQueries), so a key can never drift between where it is
 * written and where it is invalidated. `list` is prefixed by `lists()` so the
 * SSE handler can invalidate every page at once.
 */
export const clientClaimKeys = {
  lists: () => ['claims', 'client-list'] as const,
  list: (page: number, pageSize: number) => [...clientClaimKeys.lists(), page, pageSize] as const,
  summary: () => ['dashboard', 'client-summary'] as const,
  detail: (id: string) => ['emotive-claims', 'client-detail', id] as const,
}

/**
 * Client-portal claims list, paginated SERVER-SIDE (no client-side cap). Same
 * `/api/claims` endpoint, but typed as the whitelisted `ClientClaimListResponse`
 * so portal code cannot even reference stripped fields (employee/faults/notes).
 * The server enforces the strip + row-level `own_customer` scope (and hides
 * archived claims from clients); this is the type-level half of that contract.
 */
export function clientClaimsListOptions(
  page = 1,
  pageSize: ClaimsPageSize = CLIENT_CLAIMS_PAGE_SIZE,
) {
  return queryOptions({
    queryKey: clientClaimKeys.list(page, pageSize),
    queryFn: async () =>
      fetchJson<ClientClaimListResponse>(`/api/claims?page=${page}&pageSize=${pageSize}`),
    staleTime: CLAIMS_LIST_STALE_MS,
    placeholderData: keepPreviousData,
  })
}

/**
 * Portal dashboard summary: phase counts across ALL of the client's claims +
 * the recent-activity feed. Served by a dedicated client-safe projection
 * endpoint (own-customer scope; no audit internals ever leave the server).
 */
export function clientPortalSummaryOptions() {
  return queryOptions({
    queryKey: clientClaimKeys.summary(),
    queryFn: async () => fetchJson<ClientPortalSummary>('/api/dashboard/client-summary'),
    staleTime: CLAIMS_LIST_STALE_MS,
  })
}

/**
 * Client-portal claim detail (emotive only — clients have no domace claims).
 * Hits `/api/emotive-claims/:id`, typed as the whitelisted `ClientClaimDetail`.
 * The server strips to client-safe fields + enforces the own-customer scope
 * (returns 404 for another customer's claim).
 */
export function clientEmotiveClaimDetailOptions(id: string) {
  return queryOptions({
    queryKey: clientClaimKeys.detail(id),
    queryFn: async () => fetchJson<ClientClaimDetail>(`/api/emotive-claims/${id}`),
    staleTime: CLAIMS_LIST_STALE_MS,
  })
}

/**
 * URL for the client claim-report PDF. Serves the SAME report document authored
 * in the internal app (claim-reports export pipeline), gated by `export.own_claims`
 * with own-customer row scope (404 for another customer's claim); rate-limited.
 */
export function clientClaimReportPdfUrl(claimKind: ClaimKind, claimId: string): string {
  const params = new URLSearchParams({ claimKind, claimId })
  return `/api/claim-reports/export/client/pdf?${params.toString()}`
}
