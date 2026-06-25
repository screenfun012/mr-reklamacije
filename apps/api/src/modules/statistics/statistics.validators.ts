import {
  StatisticsSearchSchema,
  StatisticsSummarySchema,
  statisticsFiltersFromSearch,
  type StatisticsSummary,
} from '@mr/shared'

export { StatisticsSummarySchema }
export type { StatisticsSummary }

export const StatisticsSummaryQuerySchema = StatisticsSearchSchema

export function statisticsFiltersFromSummaryQuery(
  query: Record<string, string | string[] | undefined>,
): ReturnType<typeof statisticsFiltersFromSearch> {
  const normalizedQuery: Record<string, string | undefined> = {}

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue
    }

    normalizedQuery[key] = Array.isArray(value) ? value[0] : value
  }

  return statisticsFiltersFromSearch(StatisticsSummaryQuerySchema.parse(normalizedQuery))
}
