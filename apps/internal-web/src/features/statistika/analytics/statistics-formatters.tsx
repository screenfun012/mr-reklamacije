import type { StatisticsVolumeTrend, StatisticsVolumeTrendDirection } from '@mr/shared'
import { getLocale, m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

function serbianReklamacijaLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) {
    return 'reklamacija'
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'reklamacije'
  }
  return 'reklamacija'
}

function formatClaimCountLabel(count: number): string {
  const locale = getLocale()
  if (locale === 'sr') {
    return `${count} ${serbianReklamacijaLabel(count)}`
  }
  return count === 1 ? `${count} claim` : `${count} claims`
}

export function formatMonthLabel(month: string): string {
  const [year, monthPart] = month.split('-')
  if (!year || !monthPart) {
    return month
  }
  return `${monthPart}.${year.slice(2)}`
}

export function trendDirectionLabel(direction: StatisticsVolumeTrendDirection): string {
  switch (direction) {
    case 'rising':
      return m.statistika_analytics_trend_rising()
    case 'falling':
      return m.statistika_analytics_trend_falling()
    case 'stable':
      return m.statistika_analytics_trend_stable()
    default: {
      const _exhaustive: never = direction
      return _exhaustive
    }
  }
}

export function formatTrendDelta(delta: number): string {
  if (delta > 0) {
    return `+${delta}`
  }
  return String(delta)
}

export function formatTrendPercent(deltaPercent: number | null): string | null {
  if (deltaPercent === null) {
    return null
  }
  if (deltaPercent > 0) {
    return `+${deltaPercent}%`
  }
  return `${deltaPercent}%`
}

export function trendSummaryText(volumeTrend: StatisticsVolumeTrend): string {
  const count = formatClaimCountLabel(Math.abs(volumeTrend.delta))
  const percent = formatTrendPercent(volumeTrend.deltaPercent)
  if (percent !== null) {
    return m.statistika_analytics_trend_summary({ count, percent })
  }
  return m.statistika_analytics_trend_summary_no_percent({ count })
}

interface TrendBadgeProps {
  direction: StatisticsVolumeTrendDirection
}

export function TrendDirectionBadge({ direction }: TrendBadgeProps): React.ReactElement {
  const Icon = direction === 'rising' ? TrendingUp : direction === 'falling' ? TrendingDown : Minus

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        direction === 'rising' && 'bg-mr-success-subtle text-mr-success-strong',
        direction === 'falling' && 'bg-mr-brand-subtle text-mr-brand-strong',
        direction === 'stable' && 'bg-muted text-muted-foreground',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {trendDirectionLabel(direction)}
    </span>
  )
}
