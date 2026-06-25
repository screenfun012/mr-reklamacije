import { m } from '@mr/i18n'

import { formatManufacturerTooltipValue } from './statistics-manufacturer-formatters.js'

interface StatisticsOutcomesDonutTooltipProps {
  label: string
  count: number
  percent: number
  color: string
}

export function StatisticsOutcomesDonutTooltip({
  label,
  count,
  percent,
  color,
}: StatisticsOutcomesDonutTooltipProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-zinc-700/80 bg-zinc-950 px-3 py-2 text-zinc-50 shadow-lg">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          {label}
        </span>
        <span className="font-semibold tabular-nums">
          {formatManufacturerTooltipValue(count, percent)}
        </span>
      </div>
    </div>
  )
}

interface StatisticsOutcomesAcceptanceTooltipProps {
  label: string | number | undefined
  ratePercent: number | null
  accepted: number
  decided: number
}

export function StatisticsOutcomesAcceptanceTooltip({
  label,
  ratePercent,
  accepted,
  decided,
}: StatisticsOutcomesAcceptanceTooltipProps): React.ReactElement | null {
  if (decided === 0) {
    return null
  }

  const rateLabel = ratePercent === null ? '—' : `${ratePercent}%`

  return (
    <div className="rounded-lg border border-zinc-700/80 bg-zinc-950 px-3 py-2 text-zinc-50 shadow-lg">
      <p className="mb-2 text-xs font-medium text-zinc-400">{label}</p>
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between gap-4">
          <span>{m.statistika_analytics_outcomes_acceptance_rate_axis()}</span>
          <span className="font-semibold tabular-nums">{rateLabel}</span>
        </div>
        <div className="flex justify-between gap-4 text-zinc-400">
          <span>{m.statistika_analytics_outcomes_outcome_accepted()}</span>
          <span className="tabular-nums">
            {formatManufacturerTooltipValue(accepted, ratePercent ?? 0)}
          </span>
        </div>
      </div>
    </div>
  )
}
