import {
  STATISTICS_OTHERS_CODE,
  STATISTICS_RANK_CYCLE_COLORS,
  STATISTICS_UNKNOWN_CODE,
  resolveStatisticsRankColor,
  type StatisticsRankChartColor,
} from './statistics-rank-colors.js'

/** @deprecated Use STATISTICS_UNKNOWN_CODE */
export const STATISTICS_UNKNOWN_MANUFACTURER_CODE = STATISTICS_UNKNOWN_CODE

/** @deprecated Use STATISTICS_OTHERS_CODE */
export const STATISTICS_MANUFACTURER_OTHERS_CODE = STATISTICS_OTHERS_CODE

export const STATISTICS_MANUFACTURER_TOP_N = 10

export type ManufacturerChartColor = StatisticsRankChartColor

export const STATISTICS_MANUFACTURER_FIXED_COLORS: Readonly<
  Record<string, ManufacturerChartColor>
> = {
  BMW: {
    fill: 'var(--color-mr-info)',
    fillStrong: 'var(--color-mr-info-strong)',
  },
  MERCEDES_BENZ: {
    fill: '#00a19a',
    fillStrong: '#008f89',
  },
  AUDI: {
    fill: 'var(--color-mr-brand)',
    fillStrong: 'var(--color-mr-brand-strong)',
  },
  VOLKSWAGEN: {
    fill: 'var(--color-mr-info-strong)',
    fillStrong: '#124ea8',
  },
  FORD: {
    fill: '#5eb3ff',
    fillStrong: '#2e90fa',
  },
  OPEL: {
    fill: '#7c6bff',
    fillStrong: '#5a4bd6',
  },
  RENAULT: {
    fill: '#f5c542',
    fillStrong: '#d4a017',
  },
  PEUGEOT: {
    fill: '#2fbf71',
    fillStrong: '#1fa971',
  },
}

export const STATISTICS_MANUFACTURER_CYCLE_COLORS = STATISTICS_RANK_CYCLE_COLORS

export const STATISTICS_OUTCOME_CHART_COLORS = {
  pending: {
    fill: 'var(--color-mr-warning)',
    fillStrong: 'var(--color-mr-warning-strong)',
  },
  accepted: {
    fill: 'var(--color-mr-success)',
    fillStrong: 'var(--color-mr-success-strong)',
  },
  rejected: {
    fill: 'var(--color-mr-error)',
    fillStrong: 'var(--color-mr-error-strong)',
  },
} as const satisfies Record<string, ManufacturerChartColor>

export function resolveManufacturerColor(code: string, cycleIndex = 0): ManufacturerChartColor {
  return resolveStatisticsRankColor(code, cycleIndex, {
    fixedColors: STATISTICS_MANUFACTURER_FIXED_COLORS,
    cycleColors: STATISTICS_MANUFACTURER_CYCLE_COLORS,
  })
}
