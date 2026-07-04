import { statisticsSummaryOptions, type StatisticsSearch } from '@mr/shared'
import { m } from '@mr/i18n'
import { useSuspenseQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'

import { StatisticsAnalyticsFilters } from './statistics-analytics-filters.js'
import { StatisticsKpiRow } from './statistics-kpi-row.js'
import {
  isStatisticsSummaryEmpty,
  StatisticsAnalyticsEmptyBanner,
} from './statistics-analytics-empty-state.js'
import { formatStatisticsPeriodSubtitle } from './statistics-period-subtitle.js'
import {
  StatisticsTrendChartsSkeleton,
  StatisticsTrendChartsPlaceholder,
} from './statistics-trend-charts-skeleton.js'

const LazyStatisticsAnalyticsCharts = lazy(() =>
  import('./statistics-analytics-charts.js').then((module) => ({
    default: module.StatisticsAnalyticsCharts,
  })),
)

export interface StatistikaAnalyticsSectionProps {
  canViewStatistics: boolean
  search: StatisticsSearch
  onSearchChange: (next: StatisticsSearch) => void
}

function StatistikaAnalyticsContent({
  search,
  onSearchChange,
}: {
  search: StatisticsSearch
  onSearchChange: (next: StatisticsSearch) => void
}): React.ReactElement {
  const { data } = useSuspenseQuery(statisticsSummaryOptions(search))
  const isEmpty = isStatisticsSummaryEmpty(data)
  const showManufacturerSection = search.manufacturerId === undefined

  return (
    <>
      <StatisticsAnalyticsFilters search={search} onSearchChange={onSearchChange} />

      <p className="font-mono text-[11px] tracking-[0.06em] text-mri-text2">
        {formatStatisticsPeriodSubtitle(search)}
      </p>

      <StatisticsKpiRow summary={data} />

      {isEmpty ? (
        <StatisticsAnalyticsEmptyBanner
          onClearFilters={() => {
            onSearchChange({})
          }}
        />
      ) : null}

      <Suspense fallback={<StatisticsTrendChartsSkeleton />}>
        <LazyStatisticsAnalyticsCharts
          summary={data}
          showManufacturerSection={showManufacturerSection}
        />
      </Suspense>
    </>
  )
}

export function StatistikaAnalyticsSection({
  canViewStatistics,
  search,
  onSearchChange,
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
        <p className="mt-1.5 text-sm text-mri-text2">{m.statistika_analytics_description()}</p>
      </div>

      <Suspense fallback={<StatisticsTrendChartsSkeleton />}>
        <StatistikaAnalyticsContent search={search} onSearchChange={onSearchChange} />
      </Suspense>
    </section>
  )
}
