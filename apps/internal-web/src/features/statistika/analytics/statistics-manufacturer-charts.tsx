import {
  collapseManufacturerRowsForDisplay,
  computeManufacturerOutcomePercents,
  type StatisticsByManufacturer,
  type StatisticsManufacturerDisplayRow,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { StatCard, StatCardContent, StatCardHeader, StatCardTitle } from './statistics-card.js'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  STATISTICS_AXIS_TICK,
  STATISTICS_MONO_GRADIENTS,
  STATISTICS_OUTCOME_COLORS,
} from './chart-theme.js'
import {
  StatisticsManufacturerOutcomeTooltip,
  StatisticsManufacturerRankTooltip,
} from './statistics-manufacturer-chart-tooltip.js'
import { resolveManufacturerDisplayName } from './statistics-manufacturer-formatters.js'

export interface StatisticsManufacturerChartsProps {
  byManufacturer: StatisticsByManufacturer
}

interface ManufacturerChartRow extends StatisticsManufacturerDisplayRow {
  label: string
}

const RANK_GRADIENT_ID = 'statistics-manufacturer-rank-gradient'

/** Design: rank bars are ONE red brand gradient — never a per-row palette. */
function ManufacturerChartGradients(): React.ReactElement {
  return (
    <defs>
      <linearGradient id={RANK_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={STATISTICS_MONO_GRADIENTS.red.from} stopOpacity={1} />
        <stop offset="100%" stopColor={STATISTICS_MONO_GRADIENTS.red.to} stopOpacity={0.9} />
      </linearGradient>
    </defs>
  )
}

function buildChartRows(items: StatisticsByManufacturer['items']): ManufacturerChartRow[] {
  return collapseManufacturerRowsForDisplay(items).map((row) => ({
    ...row,
    label: resolveManufacturerDisplayName(row),
  }))
}

function computeChartHeight(rowCount: number): number {
  return Math.max(220, rowCount * 34 + 56)
}

function outcomeLegendFormatter(value: string): React.ReactNode {
  const color =
    value === m.statistika_analytics_manufacturer_outcome_pending()
      ? STATISTICS_OUTCOME_COLORS.pending
      : value === m.statistika_analytics_manufacturer_outcome_accepted()
        ? STATISTICS_OUTCOME_COLORS.accepted
        : STATISTICS_OUTCOME_COLORS.rejected

  return (
    <span className="inline-flex items-center gap-2 text-xs text-mri-text2">
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {value}
    </span>
  )
}

export function StatisticsManufacturerCharts({
  byManufacturer,
}: StatisticsManufacturerChartsProps): React.ReactElement {
  const chartRows = buildChartRows(byManufacturer.items)
  const chartHeight = computeChartHeight(chartRows.length)

  const pendingLabel = m.statistika_analytics_manufacturer_outcome_pending()
  const acceptedLabel = m.statistika_analytics_manufacturer_outcome_accepted()
  const rejectedLabel = m.statistika_analytics_manufacturer_outcome_rejected()

  const totalClaims = chartRows.reduce((sum, row) => sum + row.total, 0)
  const totalPending = chartRows.reduce((sum, row) => sum + row.pending, 0)
  const totalAccepted = chartRows.reduce((sum, row) => sum + row.accepted, 0)
  const totalRejected = chartRows.reduce((sum, row) => sum + row.rejected, 0)
  const topRow = chartRows[0]

  if (chartRows.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
            {m.statistika_analytics_manufacturer_section_title()}
          </h3>
          <p className="mt-1.5 text-sm text-mri-text2">
            {m.statistika_analytics_manufacturer_section_description()}
          </p>
        </div>
        <StatCard>
          <StatCardContent className="py-8 text-center text-sm text-mri-text2">
            {m.statistika_analytics_manufacturer_claims()}: 0
          </StatCardContent>
        </StatCard>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
          {m.statistika_analytics_manufacturer_section_title()}
        </h3>
        <p className="mt-1.5 text-sm text-mri-text2">
          {m.statistika_analytics_manufacturer_section_description()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <StatCard className="flex h-full flex-col">
          <StatCardHeader>
            <StatCardTitle>{m.statistika_analytics_manufacturer_rank_title()}</StatCardTitle>
          </StatCardHeader>
          <StatCardContent className="flex flex-1 flex-col gap-4">
            <div className="grid min-h-[5.5rem] shrink-0 grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-[10px] border border-mri-border bg-mri-inbg px-2 py-3">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
                  {m.statistika_analytics_total()}
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-text">
                  {totalClaims}
                </p>
              </div>
              <div className="rounded-[10px] border border-mri-border bg-mri-inbg px-2 py-3">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
                  {m.statistika_analytics_manufacturer_claims()}
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-text">
                  {chartRows.length}
                </p>
              </div>
              <div className="rounded-[10px] border border-mri-border bg-mri-inbg px-2 py-3">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
                  {topRow?.label ?? '—'}
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-text">
                  {topRow?.total ?? 0}
                </p>
              </div>
            </div>
            <div className="w-full shrink-0" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <ManufacturerChartGradients />
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--mri-border)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={112}
                    tickLine={false}
                    axisLine={false}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <Tooltip content={<StatisticsManufacturerRankTooltip />} />
                  <Bar
                    animationDuration={650}
                    dataKey="total"
                    fill={`url(#${RANK_GRADIENT_ID})`}
                    radius={[0, 6, 6, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </StatCardContent>
        </StatCard>

        <StatCard className="flex h-full flex-col">
          <StatCardHeader>
            <StatCardTitle>{m.statistika_analytics_manufacturer_outcome_title()}</StatCardTitle>
          </StatCardHeader>
          <StatCardContent className="flex flex-1 flex-col gap-4">
            <div className="grid min-h-[5.5rem] shrink-0 grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-[10px] border border-mri-border bg-mri-inbg px-2 py-3">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
                  {pendingLabel}
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-warn">
                  {totalPending}
                </p>
              </div>
              <div className="rounded-[10px] border border-mri-border bg-mri-inbg px-2 py-3">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
                  {acceptedLabel}
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-ok">
                  {totalAccepted}
                </p>
              </div>
              <div className="rounded-[10px] border border-mri-border bg-mri-inbg px-2 py-3">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
                  {rejectedLabel}
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-bad">
                  {totalRejected}
                </p>
              </div>
            </div>
            <div className="w-full shrink-0" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRows}
                  layout="vertical"
                  stackOffset="expand"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--mri-border)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                    tickLine={false}
                    axisLine={false}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={112}
                    tickLine={false}
                    axisLine={false}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <Tooltip
                    content={({ active, label }) => {
                      const row = chartRows.find((entry) => entry.label === label)
                      if (!row) {
                        return null
                      }
                      const percents = computeManufacturerOutcomePercents(row)
                      return (
                        <StatisticsManufacturerOutcomeTooltip
                          active={active}
                          label={label}
                          rows={[
                            {
                              label: pendingLabel,
                              count: row.pending,
                              percent: percents.pendingPercent,
                              color: STATISTICS_OUTCOME_COLORS.pending,
                            },
                            {
                              label: acceptedLabel,
                              count: row.accepted,
                              percent: percents.acceptedPercent,
                              color: STATISTICS_OUTCOME_COLORS.accepted,
                            },
                            {
                              label: rejectedLabel,
                              count: row.rejected,
                              percent: percents.rejectedPercent,
                              color: STATISTICS_OUTCOME_COLORS.rejected,
                            },
                          ]}
                        />
                      )
                    }}
                  />
                  <Legend formatter={outcomeLegendFormatter} />
                  <Bar
                    animationDuration={650}
                    dataKey="pending"
                    name={pendingLabel}
                    stackId="outcome"
                    fill={STATISTICS_OUTCOME_COLORS.pending}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    animationDuration={650}
                    dataKey="accepted"
                    name={acceptedLabel}
                    stackId="outcome"
                    fill={STATISTICS_OUTCOME_COLORS.accepted}
                  />
                  <Bar
                    animationDuration={650}
                    dataKey="rejected"
                    name={rejectedLabel}
                    stackId="outcome"
                    fill={STATISTICS_OUTCOME_COLORS.rejected}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </StatCardContent>
        </StatCard>
      </div>
    </section>
  )
}
