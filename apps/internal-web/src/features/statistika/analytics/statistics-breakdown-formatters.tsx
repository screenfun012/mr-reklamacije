import {
  STATISTICS_FIELD_PREDATES_CODE,
  STATISTICS_FIELD_UNFILLED_CODE,
  STATISTICS_OTHERS_CODE,
  STATISTICS_UNKNOWN_CODE,
  type StatisticsRankDisplayRow,
  type StatisticsRankRow,
} from '@mr/shared'
import { m } from '@mr/i18n'

/** A rank row that may name a retired catalogue entry — the claim still carries it, so it is drawn. */
export interface StatisticsRetirableRankRow extends StatisticsRankRow {
  isActive?: boolean
}

export function resolveBreakdownDisplayName(
  row: StatisticsRankDisplayRow<StatisticsRetirableRankRow>,
): string {
  if (row.code === STATISTICS_UNKNOWN_CODE) {
    return m.statistika_analytics_breakdown_unknown()
  }

  if (row.code === STATISTICS_OTHERS_CODE) {
    return m.statistika_analytics_breakdown_others()
  }

  // The server never writes Serbian for these two — it sends the code and an empty name.
  if (row.code === STATISTICS_FIELD_UNFILLED_CODE) {
    return m.statistika_field_unfilled()
  }

  if (row.code === STATISTICS_FIELD_PREDATES_CODE) {
    return m.statistika_field_predates()
  }

  if (row.isActive === false) {
    return `${row.name} †`
  }

  return row.name
}
