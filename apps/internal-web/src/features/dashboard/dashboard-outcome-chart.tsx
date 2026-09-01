import type { DashboardChartMonth } from '@mr/shared'
import { m } from '@mr/i18n'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { InternalCard } from '~/components/internal-card'
import { formatInternalChartMonth } from '~/lib/internal-format'
import { useLocale } from '@mr/ui'

export interface DashboardClaimsChartProps {
  data: readonly DashboardChartMonth[]
}

const AXIS_TICK_STYLE = {
  fontSize: 9.5,
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.08em',
  fill: 'var(--mri-text2)',
} as const

function LegendChip({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-[7px] text-xs text-mri-text2">
      <span aria-hidden="true" className={`size-[9px] rounded-[3px] ${colorClass}`} />
      {label}
    </span>
  )
}

export function DashboardClaimsChart({ data }: DashboardClaimsChartProps) {
  const { locale } = useLocale()
  const chartData = data.map((entry) => ({
    ...entry,
    label: formatInternalChartMonth(entry.month, locale),
  }))

  return (
    <InternalCard className="px-[26px] py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-mri-text">{m.dashboard_chart_title()}</h2>
        <div className="flex flex-wrap gap-[18px]">
          <LegendChip colorClass="bg-mri-info" label={m.dashboard_chart_emotive()} />
          <LegendChip colorClass="bg-mri-domace" label={m.dashboard_chart_domace()} />
        </div>
      </div>
      <div className="h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--mri-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK_STYLE} />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
              tick={AXIS_TICK_STYLE}
            />
            <Tooltip
              cursor={{ fill: 'var(--mri-rowhv)' }}
              contentStyle={{
                borderRadius: 10,
                border: '1px solid var(--mri-border)',
                backgroundColor: 'var(--mri-surface)',
                color: 'var(--mri-text)',
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="emotive"
              name={m.dashboard_chart_emotive()}
              fill="var(--color-mri-info)"
              radius={[4, 4, 0, 0]}
              maxBarSize={38}
              animationDuration={800}
            />
            <Bar
              dataKey="domace"
              name={m.dashboard_chart_domace()}
              fill="var(--color-mri-domace)"
              radius={[4, 4, 0, 0]}
              maxBarSize={38}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </InternalCard>
  )
}
