export const STATISTICS_UNKNOWN_MANUFACTURER_CODE = 'UNKNOWN'

/** UI roll-up bucket — not the catalog code `OSTALO`. */
export const STATISTICS_MANUFACTURER_OTHERS_CODE = 'OTHERS'

export const STATISTICS_MANUFACTURER_TOP_N = 10

export interface ManufacturerChartColor {
  fill: string
  fillStrong: string
}

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

export const STATISTICS_MANUFACTURER_CYCLE_COLORS: readonly ManufacturerChartColor[] = [
  { fill: 'var(--color-mr-brand-400)', fillStrong: 'var(--color-mr-brand)' },
  { fill: 'var(--color-mr-warning)', fillStrong: 'var(--color-mr-warning-strong)' },
  { fill: '#14b8a6', fillStrong: '#0d9488' },
  { fill: '#a855f7', fillStrong: '#7e22ce' },
  { fill: '#f97316', fillStrong: '#c2410c' },
  { fill: '#06b6d4', fillStrong: '#0891b2' },
  { fill: '#ec4899', fillStrong: '#be185d' },
  { fill: '#84cc16', fillStrong: '#4d7c0f' },
]

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
  if (code === STATISTICS_UNKNOWN_MANUFACTURER_CODE) {
    return {
      fill: 'var(--color-mr-neutral-400)',
      fillStrong: 'var(--color-mr-neutral-500)',
    }
  }

  if (code === STATISTICS_MANUFACTURER_OTHERS_CODE) {
    return {
      fill: 'var(--color-mr-neutral-500)',
      fillStrong: 'var(--color-mr-neutral-600)',
    }
  }

  const fixed = STATISTICS_MANUFACTURER_FIXED_COLORS[code]
  if (fixed) {
    return fixed
  }

  const normalizedIndex =
    ((cycleIndex % STATISTICS_MANUFACTURER_CYCLE_COLORS.length) +
      STATISTICS_MANUFACTURER_CYCLE_COLORS.length) %
    STATISTICS_MANUFACTURER_CYCLE_COLORS.length

  return STATISTICS_MANUFACTURER_CYCLE_COLORS[normalizedIndex]!
}
