import { dashboardSummaryOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { useSuspenseQuery } from '@tanstack/react-query'

import { DashboardClaimList } from './dashboard-claim-list'
import { DashboardClaimsChart } from './dashboard-outcome-chart'
import { DashboardStatCards } from './dashboard-stat-cards'

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
      <DashboardClaimsChart data={data.chart} />
    </div>
  )
}
