export const STATISTICS_UNKNOWN_CODE = 'UNKNOWN'

/** UI roll-up bucket — not a catalog code like `OSTALO`. */
export const STATISTICS_OTHERS_CODE = 'OTHERS'

export const STATISTICS_RANK_TOP_N = 10

export interface StatisticsRankChartColor {
  fill: string
  fillStrong: string
}

export const STATISTICS_RANK_CYCLE_COLORS: readonly StatisticsRankChartColor[] = [
  { fill: 'var(--color-mr-brand-400)', fillStrong: 'var(--color-mr-brand)' },
  { fill: 'var(--color-mr-warning)', fillStrong: 'var(--color-mr-warning-strong)' },
  { fill: '#14b8a6', fillStrong: '#0d9488' },
  { fill: '#a855f7', fillStrong: '#7e22ce' },
  { fill: '#f97316', fillStrong: '#c2410c' },
  { fill: '#06b6d4', fillStrong: '#0891b2' },
  { fill: '#ec4899', fillStrong: '#be185d' },
  { fill: '#84cc16', fillStrong: '#4d7c0f' },
]

export interface ResolveStatisticsRankColorOptions {
  fixedColors?: Readonly<Record<string, StatisticsRankChartColor>>
  cycleColors?: readonly StatisticsRankChartColor[]
}

export function resolveStatisticsRankColor(
  code: string,
  cycleIndex = 0,
  options: ResolveStatisticsRankColorOptions = {},
): StatisticsRankChartColor {
  const cycleColors = options.cycleColors ?? STATISTICS_RANK_CYCLE_COLORS

  if (code === STATISTICS_UNKNOWN_CODE) {
    return {
      fill: 'var(--color-mr-neutral-400)',
      fillStrong: 'var(--color-mr-neutral-500)',
    }
  }

  if (code === STATISTICS_OTHERS_CODE) {
    return {
      fill: 'var(--color-mr-neutral-500)',
      fillStrong: 'var(--color-mr-neutral-600)',
    }
  }

  const fixed = options.fixedColors?.[code]
  if (fixed) {
    return fixed
  }

  const normalizedIndex =
    ((cycleIndex % cycleColors.length) + cycleColors.length) % cycleColors.length

  return cycleColors[normalizedIndex]!
}
