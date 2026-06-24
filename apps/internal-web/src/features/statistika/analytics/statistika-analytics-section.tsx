import { statisticsSummaryOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { useSuspenseQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'

import {
  StatisticsTrendChartsSkeleton,
  StatisticsTrendChartsPlaceholder,
} from './statistics-trend-charts-skeleton.js'

const LazyStatisticsTrendCharts = lazy(() =>
  import('./statistics-trend-charts.js').then((module) => ({
    default: module.StatisticsTrendCharts,
  })),
)

export interface StatistikaAnalyticsSectionProps {
  canViewStatistics: boolean
}

function StatistikaAnalyticsContent(): React.ReactElement {
  const { data } = useSuspenseQuery(statisticsSummaryOptions())

  return (
    <Suspense fallback={<StatisticsTrendChartsSkeleton />}>
      <LazyStatisticsTrendCharts trends={data.trends} />
    </Suspense>
  )
}

export function StatistikaAnalyticsSection({
  canViewStatistics,
}: StatistikaAnalyticsSectionProps): React.ReactElement {
  if (!canViewStatistics) {
    return <StatisticsTrendChartsPlaceholder message={m.statistika_analytics_no_permission()} />
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {m.statistika_analytics_title()}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.statistika_analytics_description()}</p>
      </div>

      <Suspense fallback={<StatisticsTrendChartsSkeleton />}>
        <StatistikaAnalyticsContent />
      </Suspense>
    </section>
  )
}
