import { dashboardSummaryOptions } from '@mr/shared'
import { useSuspenseQuery } from '@tanstack/react-query'

import { DashboardOverdueTable } from './dashboard-overdue-table'
import { DashboardStatCards } from './dashboard-stat-cards'

export function DashboardContent() {
  const { data } = useSuspenseQuery(dashboardSummaryOptions())

  return (
    <div className="flex flex-col gap-6">
      <DashboardStatCards stats={data.stats} />
      <DashboardOverdueTable items={data.overdue} />
    </div>
  )
}
