import {
  STATISTICS_OTHERS_CODE,
  STATISTICS_RANK_TOP_N,
  STATISTICS_UNKNOWN_CODE,
} from '../constants/statistics-rank-colors.js'

export const StatisticsRankDisplaySegment = {
  Known: 'known',
  Others: 'others',
  Unknown: 'unknown',
} as const

export type StatisticsRankDisplaySegment =
  (typeof StatisticsRankDisplaySegment)[keyof typeof StatisticsRankDisplaySegment]

export interface StatisticsRankRow {
  code: string
  name: string
  total: number
}

export interface StatisticsRankDisplayRow<T extends StatisticsRankRow> extends T {
  segment: StatisticsRankDisplaySegment
}

export interface CollapseRankRowsOptions {
  rollupOthers?: boolean
}

export function isStatisticsUnknownRankRow(row: Pick<StatisticsRankRow, 'code'>): boolean {
  return row.code === STATISTICS_UNKNOWN_CODE
}

export function collapseRankRowsForDisplay<T extends StatisticsRankRow>(
  items: readonly T[],
  topN: number = STATISTICS_RANK_TOP_N,
  options: CollapseRankRowsOptions = {},
): StatisticsRankDisplayRow<T>[] {
  const rollupOthers = options.rollupOthers ?? true
  const unknown = items.find(isStatisticsUnknownRankRow)
  const known = items.filter((row) => !isStatisticsUnknownRankRow(row))
  const top = known.slice(0, topN)
  const rest = known.slice(topN)

  const result: StatisticsRankDisplayRow<T>[] = top.map((row) => ({
    ...row,
    segment: StatisticsRankDisplaySegment.Known,
  }))

  if (rollupOthers && rest.length > 0) {
    const rolledUpTotal = rest.reduce((sum, row) => sum + row.total, 0)
    if (rolledUpTotal > 0) {
      result.push({
        code: STATISTICS_OTHERS_CODE,
        name: '',
        total: rolledUpTotal,
        segment: StatisticsRankDisplaySegment.Others,
      } as StatisticsRankDisplayRow<T>)
    }
  }

  if (unknown && unknown.total > 0) {
    result.push({
      ...unknown,
      segment: StatisticsRankDisplaySegment.Unknown,
    })
  }

  return result
}
