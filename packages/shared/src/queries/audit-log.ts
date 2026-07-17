import { infiniteQueryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { AuditLogListQuery, AuditLogListResponse } from '../schemas/audit-log.schema.js'

const AUDIT_LOG_STALE_MS = 15_000
const AUDIT_LOG_PAGE_SIZE = 50

/** Filter fields a caller may set — cursor/limit are managed by the query itself. */
export type AuditLogFilters = Omit<AuditLogListQuery, 'cursor' | 'limit'>

function auditLogListQueryKey(filters: AuditLogFilters): readonly ['audit-log', AuditLogFilters] {
  return ['audit-log', filters] as const
}

function serializeAuditLogParams(filters: AuditLogFilters, cursor: string | undefined): string {
  const params = new URLSearchParams()
  params.set('limit', String(AUDIT_LOG_PAGE_SIZE))

  if (filters.actorUserId !== undefined) {
    params.set('actorUserId', filters.actorUserId)
  }
  if (filters.entityType !== undefined) {
    params.set('entityType', filters.entityType)
  }
  if (filters.entityId !== undefined) {
    params.set('entityId', filters.entityId)
  }
  if (filters.action !== undefined) {
    params.set('action', filters.action)
  }
  if (filters.dateFrom !== undefined) {
    params.set('dateFrom', filters.dateFrom)
  }
  if (filters.dateTo !== undefined) {
    params.set('dateTo', filters.dateTo)
  }
  if (cursor !== undefined) {
    params.set('cursor', cursor)
  }

  return params.toString()
}

/**
 * The audit-log is an append-only review feed, refreshed by its 15s staleTime
 * plus refetchOnWindowFocus (switch away and back, or reopen, to pull the latest
 * rows). It is deliberately NOT SSE-invalidated: busting an infinite list on
 * every audited action (every claim edit, catalog CRUD, approval, convert…)
 * would refetch every loaded page for marginal freshness on a history view.
 */
export function auditLogListOptions(filters: AuditLogFilters) {
  return infiniteQueryOptions({
    queryKey: auditLogListQueryKey(filters),
    queryFn: ({ pageParam }) =>
      fetchJson<AuditLogListResponse>(
        `/api/audit-log?${serializeAuditLogParams(filters, pageParam)}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: AuditLogListResponse) => lastPage.nextCursor ?? undefined,
    staleTime: AUDIT_LOG_STALE_MS,
  })
}
