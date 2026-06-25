import {
  collapseRankRowsForDisplay,
  resolveStatisticsRankColor,
  STATISTICS_RANK_CYCLE_COLORS,
  STATISTICS_SOURCE_FIXED_COLORS,
  type StatisticsByEmployee,
  type StatisticsByEngineType,
  type StatisticsBySource,
  type StatisticsRankChartColor,
  type StatisticsRankDisplayRow,
  type StatisticsRankRow,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@mr/ui'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { resolveBreakdownDisplayName } from './statistics-breakdown-formatters.js'
import { StatisticsManufacturerRankTooltip } from './statistics-manufacturer-chart-tooltip.js'

export interface StatisticsBreakdownChartsProps {
  bySource: StatisticsBySource
  byEmployee: StatisticsByEmployee
  byEngineType: StatisticsByEngineType
}

interface BreakdownChartRow extends StatisticsRankDisplayRow<StatisticsRankRow> {
  label: string
  fill: string
  colorIndex: number
}

function breakdownGradientId(prefix: string, code: string): string {
  return `statistics-breakdown-${prefix}-${code.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function BreakdownChartGradients({
  prefix,
  rows,
  resolveColor,
}: {
  prefix: string
  rows: readonly BreakdownChartRow[]
  resolveColor: (code: string, cycleIndex: number) => StatisticsRankChartColor
}): React.ReactElement {
  return (
    <defs>
      {rows.map((row) => {
        const colors = resolveColor(row.code, row.colorIndex)
        return (
          <linearGradient
            key={row.code}
            id={breakdownGradientId(prefix, row.code)}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0%" stopColor={colors.fillStrong} stopOpacity={1} />
            <stop offset="100%" stopColor={colors.fill} stopOpacity={0.9} />
          </linearGradient>
        )
      })}
    </defs>
  )
}

function buildBreakdownChartRows(
  items: readonly StatisticsRankRow[],
  resolveColor: (code: string, cycleIndex: number) => StatisticsRankChartColor,
  rollupOthers: boolean,
): BreakdownChartRow[] {
  return collapseRankRowsForDisplay(items, 10, { rollupOthers }).map((row, index) => {
    const colors = resolveColor(row.code, index)
    return {
      ...row,
      label: resolveBreakdownDisplayName(row),
      fill: colors.fill,
      colorIndex: index,
    }
  })
}

function computeChartHeight(rowCount: number): number {
  return Math.max(220, rowCount * 34 + 56)
}

interface BreakdownRankCardProps {
  prefix: string
  title: string
  items: readonly StatisticsRankRow[]
  resolveColor: (code: string, cycleIndex: number) => StatisticsRankChartColor
  rollupOthers: boolean
}

function BreakdownRankCard({
  prefix,
  title,
  items,
  resolveColor,
  rollupOthers,
}: BreakdownRankCardProps): React.ReactElement | null {
  const chartRows = buildBreakdownChartRows(items, resolveColor, rollupOthers)

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
          <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
            <p className="text-xs text-muted-foreground">{m.statistika_analytics_total()}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{totalClaims}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
            <p className="text-xs text-muted-foreground">
              {m.statistika_analytics_breakdown_claims()}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {chartRows.length}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
            <p className="text-xs text-muted-foreground">{topRow?.label ?? '—'}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
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
              <BreakdownChartGradients
                prefix={prefix}
                rows={chartRows}
                resolveColor={resolveColor}
              />
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/70"
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="label"
                width={112}
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
              />
              <Tooltip content={<StatisticsManufacturerRankTooltip />} />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {chartRows.map((row) => (
                  <Cell key={row.code} fill={`url(#${breakdownGradientId(prefix, row.code)})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function resolveSourceColor(code: string, cycleIndex: number): StatisticsRankChartColor {
  return resolveStatisticsRankColor(code, cycleIndex, {
    fixedColors: STATISTICS_SOURCE_FIXED_COLORS,
    cycleColors: STATISTICS_RANK_CYCLE_COLORS,
  })
}

function resolveCyclicColor(code: string, cycleIndex: number): StatisticsRankChartColor {
  return resolveStatisticsRankColor(code, cycleIndex, {
    cycleColors: STATISTICS_RANK_CYCLE_COLORS,
  })
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
            <h3 className="text-sm font-semibold text-foreground">
              {m.statistika_analytics_source_section_title()}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.statistika_analytics_source_section_description()}
            </p>
          </div>
          <BreakdownRankCard
            prefix="source"
            title={m.statistika_analytics_source_section_title()}
            items={bySource.items}
            resolveColor={resolveSourceColor}
            rollupOthers={false}
          />
        </>
      ) : null}

      {showEmployee ? (
        <>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {m.statistika_analytics_employee_section_title()}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.statistika_analytics_employee_section_description()}
            </p>
          </div>
          <BreakdownRankCard
            prefix="employee"
            title={m.statistika_analytics_employee_section_title()}
            items={byEmployee.items}
            resolveColor={resolveCyclicColor}
            rollupOthers
          />
        </>
      ) : null}

      {showEngineType ? (
        <>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {m.statistika_analytics_engine_type_section_title()}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.statistika_analytics_engine_type_section_description()}
            </p>
          </div>
          <BreakdownRankCard
            prefix="engine-type"
            title={m.statistika_analytics_engine_type_section_title()}
            items={byEngineType.items}
            resolveColor={resolveCyclicColor}
            rollupOthers
          />
        </>
      ) : null}
    </section>
  )
}
