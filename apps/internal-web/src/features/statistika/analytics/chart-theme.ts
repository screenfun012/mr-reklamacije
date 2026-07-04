/**
 * Kind palette for statistics charts (DESIGN-GUIDELINES §2): EMOTIVE blue,
 * DOMAĆE purple — never red (red is reserved for brand/actions). The total
 * series is the brand-red accent per the design's "Ukupan trend" module.
 */
export const STATISTICS_CHART_COLORS = {
  emotive: 'var(--color-mri-info)',
  emotiveStrong: 'var(--color-mri-info-strong)',
  domace: 'var(--color-mri-domace)',
  domaceStrong: 'var(--color-mri-domace-strong)',
  total: 'var(--color-mri-red)',
  totalStrong: 'var(--color-mri-redh)',
} as const

export const STATISTICS_GRADIENT_IDS = {
  emotive: 'statistics-emotive-gradient',
  domace: 'statistics-domace-gradient',
  total: 'statistics-total-gradient',
} as const

/**
 * Status colors are CONSTANT across themes (DESIGN-GUIDELINES §2) — literal
 * values on purpose so SVG fills never depend on CSS-var resolution.
 */
export const STATISTICS_OUTCOME_COLORS = {
  pending: '#f5a623',
  accepted: '#1fa971',
  acceptedStrong: '#27c286',
  rejected: '#e05c52',
} as const

/** Monochrome gradients per breakdown chart (README §8): one hue per module. */
export const STATISTICS_MONO_GRADIENTS = {
  /** Rank / employee — brand red. */
  red: { from: '#ed1c24', to: '#ff4b52' },
  /** Source — EMOTIVE blue. */
  blue: { from: '#1d6fd6', to: '#2e90fa' },
  /** Engine type — neutral gray. */
  gray: { from: '#6b6c72', to: '#96969e' },
  /** Acceptance rate — success green. */
  green: { from: '#1fa971', to: '#27c286' },
} as const

/** Mono axis ticks shared by every statistics chart. */
export const STATISTICS_AXIS_TICK = {
  fontSize: 9.5,
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.08em',
  fill: 'var(--mri-text2)',
} as const
