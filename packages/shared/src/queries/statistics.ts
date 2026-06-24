import { queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { StatisticsSummary } from '../schemas/statistics.schema.js'

export const statisticsKeys = {
  all: ['statistics'] as const,
  summary: () => [...statisticsKeys.all, 'summary'] as const,
}

const STATISTICS_SUMMARY_STALE_MS = 60_000

export function statisticsSummaryOptions() {
  return queryOptions({
    queryKey: statisticsKeys.summary(),
    queryFn: () => fetchJson<StatisticsSummary>('/api/statistics/summary'),
    staleTime: STATISTICS_SUMMARY_STALE_MS,
  })
}
