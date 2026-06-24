import { queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { DashboardSummary } from '../schemas/dashboard.schema.js'

export const dashboardKeys = {
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
