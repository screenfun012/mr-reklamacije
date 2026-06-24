import type { DashboardStatTrend } from '@mr/shared'
import { m } from '@mr/i18n'
import { cn } from '@mr/ui'

export interface DashboardStatTrendBadgeProps {
  trend: DashboardStatTrend
}

export function DashboardStatTrendBadge({ trend }: DashboardStatTrendBadgeProps) {
  const { delta } = trend
  const direction = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'

  const toneClass =
    direction === 'up'
      ? 'border-mr-info/45 bg-mr-info-subtle text-mr-info-strong dark:border-mr-info/55 dark:bg-mr-info/20 dark:text-mr-info'
      : 'border-mr-neutral-border bg-mr-neutral-subtle text-mr-neutral-muted dark:border-mr-neutral-muted/45 dark:bg-mr-neutral-muted/20 dark:text-mr-neutral-border'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums',
        toneClass,
      )}
      title={m.dashboard_trend_vs_last_month()}
    >
      {arrow} {Math.abs(delta)}
    </span>
  )
}
