import {
  STATISTICS_OTHERS_CODE,
  STATISTICS_UNKNOWN_CODE,
  type StatisticsManufacturerDisplayRow,
} from '@mr/shared'
import { m } from '@mr/i18n'

export function resolveManufacturerDisplayName(row: StatisticsManufacturerDisplayRow): string {
  if (row.code === STATISTICS_UNKNOWN_CODE) {
    return m.statistika_analytics_manufacturer_unknown()
  }

  if (row.code === STATISTICS_OTHERS_CODE) {
    return m.statistika_analytics_manufacturer_others()
  }

  return row.name
}

export function formatManufacturerTooltipValue(count: number, percent: number): string {
  const percentLabel = `${percent}%`
  return m.statistika_analytics_manufacturer_tooltip_value({ count, percent: percentLabel })
}
