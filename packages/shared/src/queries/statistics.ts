import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { StatisticsSummary } from '../schemas/statistics.schema.js'
import type { StatisticsSummaryFilters } from './statistics-filters.js'
import { normalizeStatisticsSummaryFilters } from './statistics-filters.js'
import {
  StatisticsSearchSchema,
  serializeStatisticsSummaryParams,
  statisticsFiltersFromSearch,
  type StatisticsSearch,
} from './statistics-search.js'

export const statisticsKeys = {
  all: ['statistics'] as const,
  summary: (filters: StatisticsSummaryFilters = {}) =>
    [...statisticsKeys.all, 'summary', normalizeStatisticsSummaryFilters(filters)] as const,
}

const STATISTICS_SUMMARY_STALE_MS = 60_000

export function statisticsSummaryQueryKeyFromSearch(
  search: StatisticsSearch,
): ReturnType<typeof statisticsKeys.summary> {
  return statisticsKeys.summary(statisticsFiltersFromSearch(search))
}

export function statisticsSummaryOptions(search: StatisticsSearch = {}) {
  const parsedSearch = StatisticsSearchSchema.parse(search)
  const filters = statisticsFiltersFromSearch(parsedSearch)

  return queryOptions({
    queryKey: statisticsKeys.summary(filters),
    queryFn: async () => {
      const query = serializeStatisticsSummaryParams(filters)
      const url = query.length > 0 ? `/api/statistics/summary?${query}` : '/api/statistics/summary'
      return fetchJson<StatisticsSummary>(url)
    },
    staleTime: STATISTICS_SUMMARY_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
