import {
  computeOutcomeDistributionPercents,
  formatStatisticsDays,
  hasProcessingTimeSample,
  STATISTICS_OUTCOME_CHART_COLORS,
  type StatisticsOutcomes,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@mr/ui'
import { Info } from 'lucide-react'
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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
      fill: STATISTICS_OUTCOME_CHART_COLORS.pending.fill,
    },
    {
      key: 'accepted',
      label: acceptedLabel,
      value: distribution.accepted,
      percent: percents.acceptedPercent,
      fill: STATISTICS_OUTCOME_CHART_COLORS.accepted.fill,
    },
    {
      key: 'rejected',
      label: rejectedLabel,
      value: distribution.rejected,
      percent: percents.rejectedPercent,
      fill: STATISTICS_OUTCOME_CHART_COLORS.rejected.fill,
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
      ? STATISTICS_OUTCOME_CHART_COLORS.pending.fill
      : value === m.statistika_analytics_outcomes_outcome_accepted()
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
          <h3 className="text-sm font-semibold text-foreground">
            {m.statistika_analytics_outcomes_section_title()}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.statistika_analytics_outcomes_section_description()}
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {m.statistika_analytics_outcomes_no_data()}
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {m.statistika_analytics_outcomes_section_title()}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {m.statistika_analytics_outcomes_section_description()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle>{m.statistika_analytics_outcomes_distribution_title()}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-4">
            {donutSlices.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutSlices}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="60%"
                      outerRadius="90%"
                      paddingAngle={2}
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {donutSlices.map((slice) => (
                        <Cell key={slice.key} fill={slice.fill} />
                      ))}
                    </Pie>
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
              <p className="py-12 text-sm text-muted-foreground">
                {m.statistika_analytics_outcomes_no_data()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2">
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
            </CardTitle>
            <p className="text-xs text-muted-foreground/75">
              {m.statistika_analytics_outcomes_processing_historical_note()}
            </p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center">
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
                <p className="text-xs text-muted-foreground">
                  {m.statistika_analytics_outcomes_processing_average()}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {hasSample ? formatProcessingDays(processingTime.averageDays) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
                <p className="text-xs text-muted-foreground">
                  {m.statistika_analytics_outcomes_processing_median()}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {hasSample ? formatProcessingDays(processingTime.medianDays) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-3">
                <p className="text-xs text-muted-foreground">
                  {m.statistika_analytics_outcomes_processing_max()}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {hasSample ? formatProcessingDays(processingTime.maxDays) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.statistika_analytics_outcomes_acceptance_rate_title()}</CardTitle>
        </CardHeader>
        <CardContent>
          {hasAcceptanceData ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={acceptanceRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    className="text-xs fill-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value: number) => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    className="text-xs fill-muted-foreground"
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
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name={m.statistika_analytics_outcomes_acceptance_rate_axis()}
                    stroke={STATISTICS_OUTCOME_CHART_COLORS.accepted.fillStrong}
                    strokeWidth={2}
                    dot={{ r: 3, fill: STATISTICS_OUTCOME_CHART_COLORS.accepted.fillStrong }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {m.statistika_analytics_outcomes_no_data()}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
