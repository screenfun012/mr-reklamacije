import {
  collapseRankRowsForDisplay,
  type StatisticsByEmployee,
  type StatisticsByEngineType,
  type StatisticsBySource,
  type StatisticsRankDisplayRow,
  type StatisticsRankRow,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Card, CardContent, CardHeader, CardTitle } from './statistics-card.js'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { STATISTICS_AXIS_TICK, STATISTICS_MONO_GRADIENTS } from './chart-theme.js'
import { resolveBreakdownDisplayName } from './statistics-breakdown-formatters.js'
import { StatisticsManufacturerRankTooltip } from './statistics-manufacturer-chart-tooltip.js'

export interface StatisticsBreakdownChartsProps {
  bySource: StatisticsBySource
  byEmployee: StatisticsByEmployee
  byEngineType: StatisticsByEngineType
}

interface BreakdownChartRow extends StatisticsRankDisplayRow<StatisticsRankRow> {
  label: string
}

type MonoGradient = (typeof STATISTICS_MONO_GRADIENTS)[keyof typeof STATISTICS_MONO_GRADIENTS]

function breakdownGradientId(prefix: string): string {
  return `statistics-breakdown-${prefix}`
}

/** Design: each breakdown chart is ONE monochrome gradient — never a palette. */
function BreakdownChartGradient({
  prefix,
  gradient,
}: {
  prefix: string
  gradient: MonoGradient
}): React.ReactElement {
  return (
    <defs>
      <linearGradient id={breakdownGradientId(prefix)} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={gradient.from} stopOpacity={1} />
        <stop offset="100%" stopColor={gradient.to} stopOpacity={0.9} />
      </linearGradient>
    </defs>
  )
}

function buildBreakdownChartRows(
  items: readonly StatisticsRankRow[],
  rollupOthers: boolean,
): BreakdownChartRow[] {
  return collapseRankRowsForDisplay(items, 10, { rollupOthers }).map((row) => ({
    ...row,
    label: resolveBreakdownDisplayName(row),
  }))
}

function computeChartHeight(rowCount: number): number {
  return Math.max(220, rowCount * 34 + 56)
}

interface BreakdownRankCardProps {
  prefix: string
  title: string
  items: readonly StatisticsRankRow[]
  gradient: MonoGradient
  rollupOthers: boolean
}

function BreakdownRankCard({
  prefix,
  title,
  items,
  gradient,
  rollupOthers,
}: BreakdownRankCardProps): React.ReactElement | null {
  const chartRows = buildBreakdownChartRows(items, rollupOthers)

  if (chartRows.length === 0) {
    return null
  }

  const chartHeight = computeChartHeight(chartRows.length)
  const totalClaims = chartRows.reduce((sum, row) => sum + row.total, 0)
  const topRow = chartRows[0]

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
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
              {m.statistika_analytics_breakdown_claims()}
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
              <BreakdownChartGradient prefix={prefix} gradient={gradient} />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mri-border)" horizontal={false} />
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
                fill={`url(#${breakdownGradientId(prefix)})`}
                radius={[0, 6, 6, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatisticsBreakdownCharts({
  bySource,
  byEmployee,
  byEngineType,
}: StatisticsBreakdownChartsProps): React.ReactElement | null {
  const showSource = bySource.items.length > 0
  const showEmployee = byEmployee.items.length > 0
  const showEngineType = byEngineType.items.length > 0

  if (!showSource && !showEmployee && !showEngineType) {
    return null
  }

  return (
    <section className="flex flex-col gap-4">
      {showSource ? (
        <>
          <div>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
              {m.statistika_analytics_source_section_title()}
            </h3>
            <p className="mt-1.5 text-sm text-mri-text2">
              {m.statistika_analytics_source_section_description()}
            </p>
          </div>
          <BreakdownRankCard
            prefix="source"
            title={m.statistika_analytics_source_section_title()}
            items={bySource.items}
            gradient={STATISTICS_MONO_GRADIENTS.blue}
            rollupOthers={false}
          />
        </>
      ) : null}

      {showEmployee ? (
        <>
          <div>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
              {m.statistika_analytics_employee_section_title()}
            </h3>
            <p className="mt-1.5 text-sm text-mri-text2">
              {m.statistika_analytics_employee_section_description()}
            </p>
          </div>
          <BreakdownRankCard
            prefix="employee"
            title={m.statistika_analytics_employee_section_title()}
            items={byEmployee.items}
            gradient={STATISTICS_MONO_GRADIENTS.red}
            rollupOthers
          />
        </>
      ) : null}

      {showEngineType ? (
        <>
          <div>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
              {m.statistika_analytics_engine_type_section_title()}
            </h3>
            <p className="mt-1.5 text-sm text-mri-text2">
              {m.statistika_analytics_engine_type_section_description()}
            </p>
          </div>
          <BreakdownRankCard
            prefix="engine-type"
            title={m.statistika_analytics_engine_type_section_title()}
            items={byEngineType.items}
            gradient={STATISTICS_MONO_GRADIENTS.gray}
            rollupOthers
          />
        </>
      ) : null}
    </section>
  )
}
