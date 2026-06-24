import {
  STATISTICS_MANUFACTURER_OTHERS_CODE,
  STATISTICS_MANUFACTURER_TOP_N,
  STATISTICS_UNKNOWN_MANUFACTURER_CODE,
} from '../constants/statistics-manufacturer-colors.js'
import type { StatisticsManufacturerRow } from '../schemas/statistics.schema.js'

export const StatisticsManufacturerDisplaySegment = {
  Known: 'known',
  Others: 'others',
  Unknown: 'unknown',
} as const

export type StatisticsManufacturerDisplaySegment =
  (typeof StatisticsManufacturerDisplaySegment)[keyof typeof StatisticsManufacturerDisplaySegment]

export interface StatisticsManufacturerDisplayRow extends StatisticsManufacturerRow {
  segment: StatisticsManufacturerDisplaySegment
}

export interface ManufacturerOutcomePercents {
  pendingPercent: number
  acceptedPercent: number
  rejectedPercent: number
}

export function isStatisticsUnknownManufacturer(row: StatisticsManufacturerRow): boolean {
  return row.manufacturerId === null || row.code === STATISTICS_UNKNOWN_MANUFACTURER_CODE
}

function sumManufacturerCounts(
  rows: readonly StatisticsManufacturerRow[],
): Pick<StatisticsManufacturerRow, 'total' | 'pending' | 'accepted' | 'rejected'> {
  return rows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      pending: acc.pending + row.pending,
      accepted: acc.accepted + row.accepted,
      rejected: acc.rejected + row.rejected,
    }),
    { total: 0, pending: 0, accepted: 0, rejected: 0 },
  )
}

export function computeManufacturerOutcomePercents(
  row: Pick<StatisticsManufacturerRow, 'total' | 'pending' | 'accepted' | 'rejected'>,
): ManufacturerOutcomePercents {
  if (row.total === 0) {
    return { pendingPercent: 0, acceptedPercent: 0, rejectedPercent: 0 }
  }

  const toPercent = (count: number): number => Math.round((count / row.total) * 1000) / 10

  return {
    pendingPercent: toPercent(row.pending),
    acceptedPercent: toPercent(row.accepted),
    rejectedPercent: toPercent(row.rejected),
  }
}

export function collapseManufacturerRowsForDisplay(
  items: readonly StatisticsManufacturerRow[],
  topN: number = STATISTICS_MANUFACTURER_TOP_N,
): StatisticsManufacturerDisplayRow[] {
  const unknown = items.find(isStatisticsUnknownManufacturer)
  const known = items.filter((row) => !isStatisticsUnknownManufacturer(row))
  const top = known.slice(0, topN)
  const rest = known.slice(topN)

  const result: StatisticsManufacturerDisplayRow[] = top.map((row) => ({
    ...row,
    segment: StatisticsManufacturerDisplaySegment.Known,
  }))

  if (rest.length > 0) {
    const rolledUp = sumManufacturerCounts(rest)
    if (rolledUp.total > 0) {
      result.push({
        manufacturerId: null,
        code: STATISTICS_MANUFACTURER_OTHERS_CODE,
        name: '',
        ...rolledUp,
        segment: StatisticsManufacturerDisplaySegment.Others,
      })
    }
  }

  if (unknown && unknown.total > 0) {
    result.push({
      ...unknown,
      segment: StatisticsManufacturerDisplaySegment.Unknown,
    })
  }

  return result
}
