import { m } from '@mr/i18n'

import { formatManufacturerTooltipValue } from './statistics-manufacturer-formatters.js'

interface StatisticsTooltipPayloadEntry {
  dataKey?: string | number
  name?: string
  value?: number
  color?: string
  payload?: {
    fill?: string
  }
}

interface StatisticsManufacturerRankTooltipProps {
  active?: boolean
  payload?: readonly StatisticsTooltipPayloadEntry[]
  label?: string | number
}

export function StatisticsManufacturerRankTooltip({
  active,
  payload,
  label,
}: StatisticsManufacturerRankTooltipProps): React.ReactElement | null {
  if (!active || payload === undefined || payload.length === 0) {
    return null
  }

  const entry = payload[0]
  const color = entry?.payload?.fill ?? entry?.color ?? 'var(--color-mr-info)'

  return (
    <div className="rounded-lg border border-zinc-700/80 bg-zinc-950 px-3 py-2 text-zinc-50 shadow-lg">
      <p className="mb-2 text-xs font-medium text-zinc-400">{label}</p>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          {m.statistika_analytics_manufacturer_claims()}
        </span>
        <span className="font-semibold tabular-nums">{entry?.value ?? 0}</span>
      </div>
    </div>
  )
}

interface OutcomeTooltipRow {
  label: string
  count: number
  percent: number
  color: string
}

interface StatisticsManufacturerOutcomeTooltipProps {
  active?: boolean
  label?: string | number | undefined
  rows?: readonly OutcomeTooltipRow[]
}

export function StatisticsManufacturerOutcomeTooltip({
  active,
  label,
  rows = [],
}: StatisticsManufacturerOutcomeTooltipProps): React.ReactElement | null {
  if (!active || rows.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-zinc-700/80 bg-zinc-950 px-3 py-2 text-zinc-50 shadow-lg">
      <p className="mb-2 text-xs font-medium text-zinc-400">{label}</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden="true"
              />
              {row.label}
            </span>
            <span className="font-semibold tabular-nums">
              {formatManufacturerTooltipValue(row.count, row.percent)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
