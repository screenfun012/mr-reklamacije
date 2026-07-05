import type { StatisticsTrends } from '@mr/shared'
import { m } from '@mr/i18n'
import { StatCard, StatCardContent, StatCardHeader, StatCardTitle } from './statistics-card.js'
import {
  Area,
  AreaChart,
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
  STATISTICS_CHART_COLORS,
  STATISTICS_GRADIENT_IDS,
} from './chart-theme.js'
import { StatisticsChartTooltip } from './statistics-chart-tooltip.js'
import {
  formatMonthLabel,
  formatTrendDelta,
  trendSummaryText,
  TrendDirectionBadge,
} from './statistics-formatters.js'

export interface StatisticsTrendChartsProps {
  trends: StatisticsTrends
}

/** Shared layout for the second-row chart pair — keep chart tops/bottoms aligned. */
const PAIR_CHART_HEIGHT = 'h-[200px]'

function ChartGradients(): React.ReactElement {
  return (
    <defs>
      <linearGradient id={STATISTICS_GRADIENT_IDS.emotive} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={STATISTICS_CHART_COLORS.emotive} stopOpacity={1} />
        <stop offset="100%" stopColor={STATISTICS_CHART_COLORS.emotiveStrong} stopOpacity={0.75} />
      </linearGradient>
      <linearGradient id={STATISTICS_GRADIENT_IDS.domace} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={STATISTICS_CHART_COLORS.domace} stopOpacity={1} />
        <stop offset="100%" stopColor={STATISTICS_CHART_COLORS.domaceStrong} stopOpacity={0.75} />
      </linearGradient>
      <linearGradient id={STATISTICS_GRADIENT_IDS.total} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={STATISTICS_CHART_COLORS.total} stopOpacity={0.35} />
        <stop offset="100%" stopColor={STATISTICS_CHART_COLORS.totalStrong} stopOpacity={0.05} />
      </linearGradient>
    </defs>
  )
}

function coloredLegendFormatter(value: string): React.ReactNode {
  const color =
    value === m.statistika_analytics_emotive()
      ? STATISTICS_CHART_COLORS.emotive
      : value === m.statistika_analytics_domace()
        ? STATISTICS_CHART_COLORS.domace
        : STATISTICS_CHART_COLORS.total

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

interface PairStatTileProps {
  label: string
  value: number | string
}

function PairStatTile({ label, value }: PairStatTileProps): React.ReactElement {
  return (
    <div className="rounded-[10px] border border-mri-border bg-mri-inbg px-2 py-3 text-center text-sm">
      <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-text">{value}</p>
    </div>
  )
}

interface PairChartMetaProps {
  children: React.ReactNode
}

function PairChartMeta({ children }: PairChartMetaProps): React.ReactElement {
  return <div className="flex min-h-[8.75rem] shrink-0 flex-col gap-4">{children}</div>
}

export function StatisticsTrendCharts({ trends }: StatisticsTrendChartsProps): React.ReactElement {
  const monthlyData = trends.byMonth.map((entry) => ({
    ...entry,
    label: formatMonthLabel(entry.month),
  }))

  const yearlyData = trends.byYear.map((entry) => ({
    ...entry,
    label: String(entry.year),
  }))

  const volumeLineData = monthlyData.map((entry) => ({
    label: entry.label,
    total: entry.total,
  }))

  const emotiveLabel = m.statistika_analytics_emotive()
  const domaceLabel = m.statistika_analytics_domace()
  const totalLabel = m.statistika_analytics_total()

  const yearlyEmotiveTotal = yearlyData.reduce((sum, entry) => sum + entry.emotive, 0)
  const yearlyDomaceTotal = yearlyData.reduce((sum, entry) => sum + entry.domace, 0)
  const yearlyGrandTotal = yearlyEmotiveTotal + yearlyDomaceTotal
  const yearlyRangeLabel =
    yearlyData.length > 0
      ? `${yearlyData[0]?.label ?? ''}–${yearlyData[yearlyData.length - 1]?.label ?? ''}`
      : '—'

  return (
    <div className="flex flex-col gap-4">
      <StatCard>
        <StatCardHeader>
          <StatCardTitle>{m.statistika_analytics_by_month_title()}</StatCardTitle>
        </StatCardHeader>
        <StatCardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mri-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                  tick={STATISTICS_AXIS_TICK}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tick={STATISTICS_AXIS_TICK}
                />
                <Tooltip content={<StatisticsChartTooltip />} />
                <Legend formatter={coloredLegendFormatter} />
                <Bar
                  animationDuration={650}
                  dataKey="emotive"
                  name={emotiveLabel}
                  fill={`url(#${STATISTICS_GRADIENT_IDS.emotive})`}
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  animationDuration={650}
                  dataKey="domace"
                  name={domaceLabel}
                  fill={`url(#${STATISTICS_GRADIENT_IDS.domace})`}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </StatCardContent>
      </StatCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <StatCard className="flex h-full flex-col">
          <StatCardHeader>
            <StatCardTitle>{m.statistika_analytics_by_year_title()}</StatCardTitle>
          </StatCardHeader>
          <StatCardContent className="flex flex-1 flex-col">
            <PairChartMeta>
              <div className="grid grid-cols-3 gap-3">
                <PairStatTile label={m.statistika_analytics_total()} value={yearlyGrandTotal} />
                <PairStatTile label={emotiveLabel} value={yearlyEmotiveTotal} />
                <PairStatTile label={domaceLabel} value={yearlyDomaceTotal} />
              </div>
              <p className="text-sm text-mri-text2">{yearlyRangeLabel}</p>
            </PairChartMeta>
            <div className={`${PAIR_CHART_HEIGHT} w-full shrink-0`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <ChartGradients />
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--mri-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <Tooltip content={<StatisticsChartTooltip />} />
                  <Legend formatter={coloredLegendFormatter} />
                  <Bar
                    animationDuration={650}
                    dataKey="emotive"
                    name={emotiveLabel}
                    fill={`url(#${STATISTICS_GRADIENT_IDS.emotive})`}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  />
                  <Bar
                    animationDuration={650}
                    dataKey="domace"
                    name={domaceLabel}
                    fill={`url(#${STATISTICS_GRADIENT_IDS.domace})`}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </StatCardContent>
        </StatCard>

        <StatCard className="flex h-full flex-col">
          <StatCardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <StatCardTitle>{m.statistika_analytics_volume_trend_title()}</StatCardTitle>
            <TrendDirectionBadge direction={trends.volumeTrend.direction} />
          </StatCardHeader>
          <StatCardContent className="flex flex-1 flex-col">
            <PairChartMeta>
              <div className="grid grid-cols-3 gap-3">
                <PairStatTile
                  label={m.statistika_analytics_total()}
                  value={trends.volumeTrend.currentPeriodTotal}
                />
                <PairStatTile
                  label={m.statistika_analytics_previous_period()}
                  value={trends.volumeTrend.previousPeriodTotal}
                />
                <PairStatTile
                  label={m.statistika_analytics_change()}
                  value={formatTrendDelta(trends.volumeTrend.delta)}
                />
              </div>
              <p className="text-sm text-mri-text2">{trendSummaryText(trends.volumeTrend)}</p>
            </PairChartMeta>
            <div className={`${PAIR_CHART_HEIGHT} w-full shrink-0`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeLineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <ChartGradients />
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--mri-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <Tooltip content={<StatisticsChartTooltip />} />
                  <Area
                    animationDuration={650}
                    type="monotone"
                    dataKey="total"
                    name={totalLabel}
                    stroke={STATISTICS_CHART_COLORS.total}
                    fill={`url(#${STATISTICS_GRADIENT_IDS.total})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: STATISTICS_CHART_COLORS.total }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </StatCardContent>
        </StatCard>
      </div>
    </div>
  )
}
