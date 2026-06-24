/** Brand chart colors — keep in sync with tooling/tailwind/index.css */
export const STATISTICS_CHART_COLORS = {
  emotive: 'var(--color-mr-info)',
  emotiveStrong: 'var(--color-mr-info-strong)',
  domace: 'var(--color-mr-brand)',
  domaceStrong: 'var(--color-mr-brand-strong)',
  total: 'var(--color-mr-info-strong)',
  totalStrong: 'var(--color-mr-brand-strong)',
} as const

export const STATISTICS_GRADIENT_IDS = {
  emotive: 'statistics-emotive-gradient',
  domace: 'statistics-domace-gradient',
  total: 'statistics-total-gradient',
} as const
