import type { StatisticsRankChartColor } from './statistics-rank-colors.js'

export const STATISTICS_SOURCE_FIXED_COLORS: Readonly<Record<string, StatisticsRankChartColor>> = {
  APPROVED_GREEN: {
    fill: 'var(--color-mr-success)',
    fillStrong: 'var(--color-mr-success-strong)',
  },
  SELMAN: {
    fill: 'var(--color-mr-info)',
    fillStrong: 'var(--color-mr-info-strong)',
  },
  VITOBELLO: {
    fill: '#00a19a',
    fillStrong: '#008f89',
  },
  JONKER: {
    fill: 'var(--color-mr-brand)',
    fillStrong: 'var(--color-mr-brand-strong)',
  },
  HMT: {
    fill: '#f97316',
    fillStrong: '#c2410c',
  },
  HR_GEO_SUPPORT: {
    fill: '#06b6d4',
    fillStrong: '#0891b2',
  },
  HR_MIROSLAV_VUJIC: {
    fill: '#ec4899',
    fillStrong: '#be185d',
  },
  AUTO_STANIC: {
    fill: '#84cc16',
    fillStrong: '#4d7c0f',
  },
}
