import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { DashboardSummary } from '../schemas/dashboard.schema.js'

const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
}

const DASHBOARD_SUMMARY_STALE_MS = 30_000

export function dashboardSummaryOptions() {
  return queryOptions({
    queryKey: dashboardKeys.summary(),
    queryFn: () => fetchJson<DashboardSummary>('/api/dashboard/summary'),
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
  await queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() })
}
