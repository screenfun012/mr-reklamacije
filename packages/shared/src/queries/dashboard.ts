import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { DashboardSummary } from '../schemas/dashboard.schema.js'

const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (months: number | undefined) => [...dashboardKeys.all, 'summary', months] as const,
}

const DASHBOARD_SUMMARY_STALE_MS = 30_000

export interface DashboardSummaryQuery {
  /**
   * How many months the trend chart covers (6…24). Omitted, the server answers with its own
   * default — which is what internal-web wants; only the admin panel, whose chart card is twice as
   * wide, asks for the longer window.
   */
  months?: number
}

export function dashboardSummaryOptions(query: DashboardSummaryQuery = {}) {
  const search = query.months === undefined ? '' : `?months=${String(query.months)}`
  return queryOptions({
    queryKey: dashboardKeys.summary(query.months),
    queryFn: () => fetchJson<DashboardSummary>(`/api/dashboard/summary${search}`),
    staleTime: DASHBOARD_SUMMARY_STALE_MS,
  })
}

/**
 * Bust the internal dashboard overview (total/pending/accepted/rejected counts,
 * overdue & recent lists, monthly chart) after a claim changes. The twin of
 * `invalidateStatisticsSummary`; called from `invalidateInternalClaimQueries`
 * so every claim mutation and SSE claim event refreshes the counts.
 */
export async function invalidateDashboardSummary(queryClient: QueryClient): Promise<void> {
  // The `all` prefix, not one window: every cached window is stale once a claim changes.
  await queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
}
