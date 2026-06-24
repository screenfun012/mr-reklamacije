import {
  collapseManufacturerRowsForDisplay,
  computeManufacturerOutcomePercents,
  resolveManufacturerColor,
  STATISTICS_OUTCOME_CHART_COLORS,
  type StatisticsByManufacturer,
  type StatisticsManufacturerDisplayRow,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@mr/ui'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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
  fill: string
  colorIndex: number
}

function manufacturerGradientId(code: string): string {
  return `statistics-manufacturer-${code.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function ManufacturerChartGradients({
  rows,
}: {
  rows: readonly ManufacturerChartRow[]
}): React.ReactElement {
  return (
    <defs>
      {rows.map((row) => {
        const colors = resolveManufacturerColor(row.code, row.colorIndex)
        return (
          <linearGradient
            key={row.code}
            id={manufacturerGradientId(row.code)}
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

function buildChartRows(items: StatisticsByManufacturer['items']): ManufacturerChartRow[] {
  return collapseManufacturerRowsForDisplay(items).map((row, index) => {
    const colors = resolveManufacturerColor(row.code, index)
    return {
      ...row,
      label: resolveManufacturerDisplayName(row),
      fill: colors.fill,
      colorIndex: index,
    }
  })
}

function computeChartHeight(rowCount: number): number {
  return Math.max(220, rowCount * 34 + 56)
}

function outcomeLegendFormatter(value: string): React.ReactNode {
  const color =
    value === m.statistika_analytics_manufacturer_outcome_pending()
      ? STATISTICS_OUTCOME_CHART_COLORS.pending.fill
      : value === m.statistika_analytics_manufacturer_outcome_accepted()
        ? STATISTICS_OUTCOME_CHART_COLORS.accepted.fill
        : STATISTICS_OUTCOME_CHART_COLORS.rejected.fill

  return (
    <span className="inline-flex items-center gap-2 text-sm text-foreground">
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
          <h3 className="text-sm font-semibold text-foreground">
            {m.statistika_analytics_manufacturer_section_title()}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.statistika_analytics_manufacturer_section_description()}
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.statistika_analytics_manufacturer_claims()}: 0
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {m.statistika_analytics_manufacturer_section_title()}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {m.statistika_analytics_manufacturer_section_description()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle>{m.statistika_analytics_manufacturer_rank_title()}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="grid min-h-[5.5rem] shrink-0 grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
                <p className="text-xs text-muted-foreground">{m.statistika_analytics_total()}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {totalClaims}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
                <p className="text-xs text-muted-foreground">
                  {m.statistika_analytics_manufacturer_claims()}
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
                  <ManufacturerChartGradients rows={chartRows} />
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
                      <Cell key={row.code} fill={`url(#${manufacturerGradientId(row.code)})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle>{m.statistika_analytics_manufacturer_outcome_title()}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="grid min-h-[5.5rem] shrink-0 grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
                <p className="text-xs text-muted-foreground">{pendingLabel}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-mr-warning-strong">
                  {totalPending}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
                <p className="text-xs text-muted-foreground">{acceptedLabel}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-mr-success-strong">
                  {totalAccepted}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
                <p className="text-xs text-muted-foreground">{rejectedLabel}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-mr-error-strong">
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
                    className="stroke-border/70"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
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
                              color: STATISTICS_OUTCOME_CHART_COLORS.pending.fill,
                            },
                            {
                              label: acceptedLabel,
                              count: row.accepted,
                              percent: percents.acceptedPercent,
                              color: STATISTICS_OUTCOME_CHART_COLORS.accepted.fill,
                            },
                            {
                              label: rejectedLabel,
                              count: row.rejected,
                              percent: percents.rejectedPercent,
                              color: STATISTICS_OUTCOME_CHART_COLORS.rejected.fill,
                            },
                          ]}
                        />
                      )
                    }}
                  />
                  <Legend formatter={outcomeLegendFormatter} />
                  <Bar
                    dataKey="pending"
                    name={pendingLabel}
                    stackId="outcome"
                    fill={STATISTICS_OUTCOME_CHART_COLORS.pending.fill}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="accepted"
                    name={acceptedLabel}
                    stackId="outcome"
                    fill={STATISTICS_OUTCOME_CHART_COLORS.accepted.fill}
                  />
                  <Bar
                    dataKey="rejected"
                    name={rejectedLabel}
                    stackId="outcome"
                    fill={STATISTICS_OUTCOME_CHART_COLORS.rejected.fill}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
