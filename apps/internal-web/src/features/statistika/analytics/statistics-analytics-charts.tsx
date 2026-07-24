import type { StatisticsSummary } from '@mr/shared'

import { StatisticsBreakdownCharts } from './statistics-breakdown-charts.js'
import { StatisticsManufacturerCharts } from './statistics-manufacturer-charts.js'
import { StatisticsOutcomesCharts } from './statistics-outcomes-charts.js'
import { StatisticsTrendCharts } from './statistics-trend-charts.js'

export interface StatisticsAnalyticsChartsProps {
  summary: StatisticsSummary
  showManufacturerSection?: boolean
}

export function StatisticsAnalyticsCharts({
  summary,
  showManufacturerSection = true,
}: StatisticsAnalyticsChartsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <StatisticsTrendCharts trends={summary.trends} />
      {showManufacturerSection ? (
        <StatisticsManufacturerCharts byManufacturer={summary.byManufacturer} />
      ) : null}
      <StatisticsOutcomesCharts outcomes={summary.outcomes} />
      <StatisticsBreakdownCharts
        byEmployee={summary.byEmployee}
        byEngineType={summary.byEngineType}
        byCustomer={summary.byCustomer}
        byFaults={summary.byFaults}
      />
    </div>
  )
}
