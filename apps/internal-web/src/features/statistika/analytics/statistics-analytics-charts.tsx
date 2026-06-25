import type { StatisticsSummary } from '@mr/shared'

import { StatisticsBreakdownCharts } from './statistics-breakdown-charts.js'
import { StatisticsManufacturerCharts } from './statistics-manufacturer-charts.js'
import { StatisticsOutcomesCharts } from './statistics-outcomes-charts.js'
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
      <StatisticsOutcomesCharts outcomes={summary.outcomes} />
      <StatisticsBreakdownCharts
        bySource={summary.bySource}
        byEmployee={summary.byEmployee}
        byEngineType={summary.byEngineType}
      />
    </div>
  )
}
