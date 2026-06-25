import type { StatisticsSearch } from '@mr/shared'
import { m } from '@mr/i18n'

export function formatStatisticsPeriodSubtitle(search: StatisticsSearch): string {
  if (search.dateFrom !== undefined && search.dateTo !== undefined) {
    return m.statistika_analytics_period_subtitle_custom({
      from: search.dateFrom,
      to: search.dateTo,
    })
  }

  if (search.year !== undefined) {
    return m.statistika_analytics_period_subtitle_year({ year: String(search.year) })
  }

  return m.statistika_analytics_period_subtitle_rolling()
}
