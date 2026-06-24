import type { StatisticsSummary } from '@mr/shared'

import { StatisticsManufacturerCharts } from './statistics-manufacturer-charts.js'
import { StatisticsTrendCharts } from './statistics-trend-charts.js'

export interface StatisticsAnalyticsChartsProps {
  summary: StatisticsSummary
}

export function StatisticsAnalyticsCharts({
  summary,
}: StatisticsAnalyticsChartsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <StatisticsTrendCharts trends={summary.trends} />
      <StatisticsManufacturerCharts byManufacturer={summary.byManufacturer} />
    </div>
  )
}
