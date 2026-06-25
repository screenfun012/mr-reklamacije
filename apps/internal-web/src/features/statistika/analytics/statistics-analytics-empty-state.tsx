import type { StatisticsSummary } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button } from '@mr/ui'

export interface StatisticsAnalyticsEmptyBannerProps {
  onClearFilters: () => void
}

export function isStatisticsSummaryEmpty(summary: StatisticsSummary): boolean {
  const monthTotal = summary.trends.byMonth.reduce((sum, row) => sum + row.total, 0)
  return monthTotal === 0 && summary.outcomes.distribution.total === 0
}

export function StatisticsAnalyticsEmptyBanner({
  onClearFilters,
}: StatisticsAnalyticsEmptyBannerProps): React.ReactElement {
  return (
    <div
      className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>{m.statistika_analytics_filter_empty()}</p>
        <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
          {m.statistika_analytics_filter_clear()}
        </Button>
      </div>
    </div>
  )
}

export function StatisticsChartEmptyState(): React.ReactElement {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      {m.statistika_analytics_chart_empty()}
    </p>
  )
}
