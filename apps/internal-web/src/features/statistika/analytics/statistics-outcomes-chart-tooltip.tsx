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
