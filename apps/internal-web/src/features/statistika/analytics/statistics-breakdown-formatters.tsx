import {
  STATISTICS_OTHERS_CODE,
  STATISTICS_UNKNOWN_CODE,
  type StatisticsRankDisplayRow,
  type StatisticsRankRow,
} from '@mr/shared'
import { m } from '@mr/i18n'

export function resolveBreakdownDisplayName(
  row: StatisticsRankDisplayRow<StatisticsRankRow>,
): string {
  if (row.code === STATISTICS_UNKNOWN_CODE) {
    return m.statistika_analytics_breakdown_unknown()
  }

  if (row.code === STATISTICS_OTHERS_CODE) {
    return m.statistika_analytics_breakdown_others()
  }

  return row.name
}
