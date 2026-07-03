import { dashboardSummaryOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { useSuspenseQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'

import { DashboardClaimsChartSkeleton } from './dashboard-chart-skeleton'
import { DashboardClaimList } from './dashboard-claim-list'
import { DashboardStatCards } from './dashboard-stat-cards'

// Lazy-loaded so recharts stays out of the entry chunk (same pattern
// as statistika-analytics-section).
const LazyDashboardClaimsChart = lazy(() =>
  import('./dashboard-outcome-chart').then((module) => ({
    default: module.DashboardClaimsChart,
  })),
)

export function DashboardContent() {
  const { data } = useSuspenseQuery(dashboardSummaryOptions())

  return (
    <div className="flex flex-col gap-6">
      <DashboardStatCards stats={data.stats} trends={data.trends} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <DashboardClaimList
          title={m.dashboard_recent_title()}
          emptyMessage={m.dashboard_recent_empty()}
          items={data.recent}
        />
        <DashboardClaimList
          title={m.dashboard_overdue_title()}
          emptyMessage={m.dashboard_overdue_empty()}
          items={data.overdue}
          daysUrgency
        />
      </div>
      <Suspense fallback={<DashboardClaimsChartSkeleton />}>
        <LazyDashboardClaimsChart data={data.chart} />
      </Suspense>
    </div>
  )
}
