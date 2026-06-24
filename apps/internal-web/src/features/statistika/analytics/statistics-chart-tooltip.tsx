interface StatisticsTooltipPayloadEntry {
  dataKey?: string | number
  name?: string
  value?: number
}

interface StatisticsChartTooltipProps {
  active?: boolean
  payload?: readonly StatisticsTooltipPayloadEntry[]
  label?: string | number
}

const SERIES_COLORS: Record<string, string> = {
  emotive: 'var(--color-mr-info)',
  domace: 'var(--color-mr-brand)',
  total: 'var(--color-mr-info-strong)',
}

export function StatisticsChartTooltip({
  active,
  payload,
  label,
}: StatisticsChartTooltipProps): React.ReactElement | null {
  if (!active || payload === undefined || payload.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-zinc-700/80 bg-zinc-950 px-3 py-2 text-zinc-50 shadow-lg">
      <p className="mb-2 text-xs font-medium text-zinc-400">{label}</p>
      <ul className="flex flex-col gap-1.5">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? entry.name ?? '')
          const color = SERIES_COLORS[key] ?? 'var(--color-mr-info)'

          return (
            <li key={key} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                {entry.name}
              </span>
              <span className="font-semibold tabular-nums">{entry.value ?? 0}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
