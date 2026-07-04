import type { DashboardStatTrend } from '@mr/shared'
import { m } from '@mr/i18n'
import { cn } from '@mr/ui'

export interface DashboardStatTrendBadgeProps {
  trend: DashboardStatTrend
  /** Rising count is BAD for this metric (e.g. pending) — flips the colors. */
  inverted?: boolean
}

/** Mono trend chip next to a KPI value: "▲ 2" / "▼ 1" / "→ 0". */
export function DashboardStatTrendBadge({ trend, inverted = false }: DashboardStatTrendBadgeProps) {
  const { delta } = trend
  const direction = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '→'

  const good = direction === 'up' ? !inverted : inverted
  const toneClass = direction === 'flat' ? 'text-mri-text2' : good ? 'text-mri-ok' : 'text-mri-bad'

  return (
    <span
      className={cn('font-mono text-[11px] font-semibold tabular-nums', toneClass)}
      title={m.dashboard_trend_vs_last_month()}
    >
      {arrow} {Math.abs(delta)}
    </span>
  )
}
