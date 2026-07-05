import {
  computeOutcomeDistributionPercents,
  formatStatisticsDays,
  hasProcessingTimeSample,
  type StatisticsOutcomes,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { StatCard, StatCardContent, StatCardHeader, StatCardTitle } from './statistics-card.js'
import { Info } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
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
import { formatMonthLabel } from './statistics-formatters.js'
import { formatManufacturerTooltipValue } from './statistics-manufacturer-formatters.js'
import { StatisticsOutcomesDonutTooltip } from './statistics-outcomes-chart-tooltip.js'

export interface StatisticsOutcomesChartsProps {
  outcomes: StatisticsOutcomes
}

interface DonutSlice {
  key: 'pending' | 'accepted' | 'rejected'
  label: string
  value: number
  percent: number
  fill: string
}

interface AcceptanceRateChartRow {
  month: string
  label: string
  decided: number
  accepted: number
  ratePercent: number | null
  rate: number
}

function buildDonutSlices(outcomes: StatisticsOutcomes): DonutSlice[] {
  const { distribution } = outcomes
  const percents = computeOutcomeDistributionPercents(distribution)

  const pendingLabel = m.statistika_analytics_outcomes_outcome_pending()
  const acceptedLabel = m.statistika_analytics_outcomes_outcome_accepted()
  const rejectedLabel = m.statistika_analytics_outcomes_outcome_rejected()

  const slices: DonutSlice[] = [
    {
      key: 'pending',
      label: pendingLabel,
      value: distribution.pending,
      percent: percents.pendingPercent,
      fill: STATISTICS_OUTCOME_COLORS.pending,
    },
    {
      key: 'accepted',
      label: acceptedLabel,
      value: distribution.accepted,
      percent: percents.acceptedPercent,
      fill: STATISTICS_OUTCOME_COLORS.accepted,
    },
    {
      key: 'rejected',
      label: rejectedLabel,
      value: distribution.rejected,
      percent: percents.rejectedPercent,
      fill: STATISTICS_OUTCOME_COLORS.rejected,
    },
  ]

  return slices.filter((slice) => slice.value > 0)
}

function buildAcceptanceRateRows(
  acceptanceRateByMonth: StatisticsOutcomes['acceptanceRateByMonth'],
): AcceptanceRateChartRow[] {
  return acceptanceRateByMonth.map((row) => ({
    ...row,
    label: formatMonthLabel(row.month),
    rate: row.ratePercent ?? 0,
  }))
}

function outcomeLegendFormatter(value: string): React.ReactNode {
  const color =
    value === m.statistika_analytics_outcomes_outcome_pending()
      ? STATISTICS_OUTCOME_COLORS.pending
      : value === m.statistika_analytics_outcomes_outcome_accepted()
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

function formatProcessingDays(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return m.statistika_analytics_outcomes_processing_days({
    days: formatStatisticsDays(value),
  })
}

export function StatisticsOutcomesCharts({
  outcomes,
}: StatisticsOutcomesChartsProps): React.ReactElement {
  const donutSlices = buildDonutSlices(outcomes)
  const acceptanceRows = buildAcceptanceRateRows(outcomes.acceptanceRateByMonth)
  const { processingTime, distribution } = outcomes
  const hasSample = hasProcessingTimeSample(processingTime)
  const hasDistribution = distribution.total > 0
  const hasAcceptanceData = acceptanceRows.some((row) => row.decided > 0)

  if (!hasDistribution && !hasSample && !hasAcceptanceData) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
            {m.statistika_analytics_outcomes_section_title()}
          </h3>
          <p className="mt-1.5 text-sm text-mri-text2">
            {m.statistika_analytics_outcomes_section_description()}
          </p>
        </div>
        <StatCard>
          <StatCardContent className="py-8 text-center text-sm text-mri-text2">
            {m.statistika_analytics_outcomes_no_data()}
          </StatCardContent>
        </StatCard>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
          {m.statistika_analytics_outcomes_section_title()}
        </h3>
        <p className="mt-1.5 text-sm text-mri-text2">
          {m.statistika_analytics_outcomes_section_description()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <StatCard className="flex h-full flex-col">
          <StatCardHeader>
            <StatCardTitle>{m.statistika_analytics_outcomes_distribution_title()}</StatCardTitle>
          </StatCardHeader>
          <StatCardContent className="flex flex-1 flex-col items-center justify-center gap-4">
            {donutSlices.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      animationDuration={650}
                      data={donutSlices}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="60%"
                      outerRadius="90%"
                      paddingAngle={2}
                      stroke="var(--mri-surface)"
                      strokeWidth={2}
                    >
                      {donutSlices.map((slice) => (
                        <Cell key={slice.key} fill={slice.fill} />
                      ))}
                    </Pie>
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 26,
                        fontWeight: 700,
                        fill: 'var(--mri-text)',
                      }}
                    >
                      {distribution.total}
                    </text>
                    <Tooltip
                      content={({ active, payload }) => {
                        const slice = payload?.[0]?.payload as DonutSlice | undefined
                        if (!active || !slice) {
                          return null
                        }

                        return (
                          <StatisticsOutcomesDonutTooltip
                            label={slice.label}
                            count={slice.value}
                            percent={slice.percent}
                            color={slice.fill}
                          />
                        )
                      }}
                    />
                    <Legend formatter={outcomeLegendFormatter} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-sm text-mri-text2">
                {m.statistika_analytics_outcomes_no_data()}
              </p>
            )}
          </StatCardContent>
        </StatCard>

        <StatCard className="flex h-full flex-col">
          <StatCardHeader className="space-y-1">
            <StatCardTitle className="flex items-center gap-2">
              <span>{m.statistika_analytics_outcomes_processing_title()}</span>
              <span
                className="inline-flex text-muted-foreground/70"
                title={m.statistika_analytics_outcomes_processing_historical_hint()}
              >
                <Info className="size-3.5" aria-hidden="true" />
                <span className="sr-only">
                  {m.statistika_analytics_outcomes_processing_historical_hint()}
                </span>
              </span>
            </StatCardTitle>
            <p className="text-xs text-mri-text2">
              {m.statistika_analytics_outcomes_processing_historical_note()}
            </p>
          </StatCardHeader>
          <StatCardContent className="flex flex-1 flex-col justify-center">
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-[10px] border border-mri-border bg-mri-inbg px-2 py-3">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
                  {m.statistika_analytics_outcomes_processing_average()}
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-text">
                  {hasSample ? formatProcessingDays(processingTime.averageDays) : '—'}
                </p>
              </div>
              <div className="rounded-[10px] border border-mri-border bg-mri-inbg px-2 py-3">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
                  {m.statistika_analytics_outcomes_processing_median()}
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-text">
                  {hasSample ? formatProcessingDays(processingTime.medianDays) : '—'}
                </p>
              </div>
              <div className="rounded-[10px] border border-[rgba(245,166,35,0.35)] bg-mri-warn-bg px-2 py-3">
                <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
                  {m.statistika_analytics_outcomes_processing_max()}
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-mri-warn">
                  {hasSample ? formatProcessingDays(processingTime.maxDays) : '—'}
                </p>
              </div>
            </div>
          </StatCardContent>
        </StatCard>
      </div>

      <StatCard>
        <StatCardHeader>
          <StatCardTitle>{m.statistika_analytics_outcomes_acceptance_rate_title()}</StatCardTitle>
        </StatCardHeader>
        <StatCardContent>
          {hasAcceptanceData ? (
            <div className="h-[190px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={acceptanceRows} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="statistics-acceptance-gradient" x1="0" y1="1" x2="0" y2="0">
                      <stop
                        offset="0%"
                        stopColor={STATISTICS_MONO_GRADIENTS.green.from}
                        stopOpacity={0.9}
                      />
                      <stop
                        offset="100%"
                        stopColor={STATISTICS_MONO_GRADIENTS.green.to}
                        stopOpacity={1}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value: number) => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tick={STATISTICS_AXIS_TICK}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) {
                        return null
                      }

                      const row = payload[0]?.payload as AcceptanceRateChartRow | undefined
                      if (!row || row.decided === 0) {
                        return null
                      }

                      const rateLabel = row.ratePercent === null ? '—' : `${row.ratePercent}%`

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
                                {formatManufacturerTooltipValue(row.accepted, row.ratePercent ?? 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    animationDuration={650}
                    dataKey="rate"
                    name={m.statistika_analytics_outcomes_acceptance_rate_axis()}
                    fill="url(#statistics-acceptance-gradient)"
                    radius={[4, 4, 2, 2]}
                    maxBarSize={22}
                  >
                    <LabelList
                      dataKey="rate"
                      position="top"
                      formatter={(value: unknown) =>
                        typeof value === 'number' && value > 0 ? `${Math.round(value)}%` : ''
                      }
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        fill: STATISTICS_MONO_GRADIENTS.green.to,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-mri-text2">
              {m.statistika_analytics_outcomes_no_data()}
            </p>
          )}
        </StatCardContent>
      </StatCard>
    </section>
  )
}
