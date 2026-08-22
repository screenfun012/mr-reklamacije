import {
  collapseRankRowsForDisplay,
  STATISTICS_FIELD_PREDATES_CODE,
  STATISTICS_FIELD_UNFILLED_CODE,
  STATISTICS_OTHERS_CODE,
  type StatisticsByCategory,
  type StatisticsByCustomer,
  type StatisticsByEmployee,
  type StatisticsByEngineType,
  type StatisticsByFaults,
  type StatisticsCategoryFieldGroup,
  type StatisticsRankDisplayRow,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { StatCard, StatCardContent, StatCardHeader, StatCardTitle } from './statistics-card.js'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { STATISTICS_AXIS_TICK, STATISTICS_MONO_GRADIENTS } from './chart-theme.js'
import {
  resolveBreakdownDisplayName,
  type StatisticsRetirableRankRow,
} from './statistics-breakdown-formatters.js'
import { StatisticsManufacturerRankTooltip } from './statistics-manufacturer-chart-tooltip.js'

/** The three codes a click carries, and the only thing this section asks the screen to do. */
export interface StatisticsAnswerSelection {
  categoryCode: string
  fieldCode: string
  optionCode: string
}

/**
 * Neither of these is an answer a claim carries: `OTHERS` is this screen's own roll-up, and the two
 * synthetic buckets are what the server says when there is nothing written down. Filtering by any
 * of them would ask the server a question with no rows behind it.
 */
const NON_FILTERABLE_BUCKET_CODES: ReadonlySet<string> = new Set([
  STATISTICS_OTHERS_CODE,
  STATISTICS_FIELD_UNFILLED_CODE,
  STATISTICS_FIELD_PREDATES_CODE,
])

export interface StatisticsBreakdownChartsProps {
  byCategory: StatisticsByCategory
  /** `null` when the reader may not see `employees.view_analytics` figures. */
  byEmployee: StatisticsByEmployee | null
  byEngineType: StatisticsByEngineType
  byCustomer: StatisticsByCustomer
  byFaults: StatisticsByFaults
  byCategoryFields: StatisticsCategoryFieldGroup[]
  onAnswerSelect: (answer: StatisticsAnswerSelection) => void
}

interface BreakdownChartRow extends StatisticsRankDisplayRow<StatisticsRetirableRankRow> {
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
  items: readonly StatisticsRetirableRankRow[],
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
  items: readonly StatisticsRetirableRankRow[]
  gradient: MonoGradient
  rollupOthers: boolean
  /** Omitted by every card whose bars answer nothing the screen could filter by. */
  onSelect?: (row: BreakdownChartRow) => void
}

function BreakdownRankCard({
  prefix,
  title,
  items,
  gradient,
  rollupOthers,
  onSelect,
}: BreakdownRankCardProps): React.ReactElement | null {
  const chartRows = buildBreakdownChartRows(items, rollupOthers)

  if (chartRows.length === 0) {
    return null
  }

  const chartHeight = computeChartHeight(chartRows.length)
  const totalClaims = chartRows.reduce((sum, row) => sum + row.total, 0)
  const topRow = chartRows[0]

  return (
    <StatCard className="flex h-full flex-col">
      <StatCardHeader>
        <StatCardTitle>{title}</StatCardTitle>
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
                cursor={onSelect === undefined ? 'default' : 'pointer'}
                onClick={(_bar, index: number) => {
                  const row = chartRows[index]
                  if (row !== undefined && onSelect !== undefined) {
                    onSelect(row)
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </StatCardContent>
    </StatCard>
  )
}

export function StatisticsBreakdownCharts({
  byCategory,
  byEmployee,
  byEngineType,
  byCustomer,
  byFaults,
  byCategoryFields,
  onAnswerSelect,
}: StatisticsBreakdownChartsProps): React.ReactElement | null {
  /**
   * Withheld and empty are different things and must look different. A reader without
   * `employees.view_analytics` gets `null` and the section simply is not there; an empty list means
   * the filters matched no work, and the section is equally absent — but for a reason the rest of
   * the screen already tells him.
   */
  const showCategory = byCategory.items.length > 0
  // A category whose fields nobody defined has nothing to draw — the block is its cards.
  const categoryFieldGroups = byCategoryFields.filter((group) => group.fields.length > 0)
  const showEmployee = byEmployee !== null && byEmployee.items.length > 0
  const faultsByEmployee = byFaults.byEmployee
  const showEngineType = byEngineType.items.length > 0
  const showCustomer = byCustomer.items.length > 0
  const showFaults =
    (faultsByEmployee?.length ?? 0) > 0 ||
    byFaults.byDepartment.length > 0 ||
    byFaults.byExternalParty.length > 0

  if (
    !showCategory &&
    !showEmployee &&
    !showEngineType &&
    !showCustomer &&
    !showFaults &&
    categoryFieldGroups.length === 0
  ) {
    return null
  }

  return (
    <section className="flex flex-col gap-4">
      {showCategory ? (
        <>
          <div>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
              {m.statistika_analytics_category_section_title()}
            </h3>
            <p className="mt-1.5 text-sm text-mri-text2">
              {m.statistika_analytics_category_section_description()}
            </p>
          </div>
          <BreakdownRankCard
            prefix="category"
            title={m.statistika_analytics_category_section_title()}
            items={byCategory.items}
            gradient={STATISTICS_MONO_GRADIENTS.teal}
            rollupOthers
          />
        </>
      ) : null}

      {categoryFieldGroups.length > 0 ? (
        <>
          <div>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
              {m.statistika_category_fields_section_title()}
            </h3>
            <p className="mt-1.5 text-sm text-mri-text2">
              {m.statistika_category_fields_section_description()}
            </p>
          </div>
          {categoryFieldGroups.map((group) => (
            <div key={group.categoryCode} className="flex flex-col gap-3">
              <h4 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mri-text2">
                {group.categoryName}
              </h4>
              <div className="grid gap-4 xl:grid-cols-2">
                {group.fields.map((field) => (
                  <BreakdownRankCard
                    key={field.fieldCode}
                    prefix={`category-field-${group.categoryCode}-${field.fieldCode}`}
                    title={field.fieldName}
                    items={field.items}
                    gradient={STATISTICS_MONO_GRADIENTS.teal}
                    rollupOthers
                    onSelect={(row) => {
                      if (NON_FILTERABLE_BUCKET_CODES.has(row.code)) {
                        return
                      }

                      onAnswerSelect({
                        categoryCode: group.categoryCode,
                        fieldCode: field.fieldCode,
                        optionCode: row.code,
                      })
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      ) : null}

      {showCustomer ? (
        <>
          <div>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
              {m.statistika_analytics_customer_section_title()}
            </h3>
            <p className="mt-1.5 text-sm text-mri-text2">
              {m.statistika_analytics_customer_section_description()}
            </p>
          </div>
          <BreakdownRankCard
            prefix="customer"
            title={m.statistika_analytics_customer_section_title()}
            items={byCustomer.items}
            gradient={STATISTICS_MONO_GRADIENTS.green}
            rollupOthers
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

      {showFaults ? (
        <>
          <div>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mri-redh">
              {m.statistika_analytics_faults_section_title()}
            </h3>
            <p className="mt-1.5 text-sm text-mri-text2">
              {m.statistika_analytics_faults_section_description()}
            </p>
          </div>
          <div
            className={
              faultsByEmployee === null ? 'grid gap-4 xl:grid-cols-2' : 'grid gap-4 xl:grid-cols-3'
            }
          >
            {faultsByEmployee === null ? null : (
              <BreakdownRankCard
                prefix="fault-employee"
                title={m.statistika_analytics_faults_by_employee()}
                items={faultsByEmployee}
                gradient={STATISTICS_MONO_GRADIENTS.red}
                rollupOthers
              />
            )}
            <BreakdownRankCard
              prefix="fault-department"
              title={m.statistika_analytics_faults_by_department()}
              items={byFaults.byDepartment}
              gradient={STATISTICS_MONO_GRADIENTS.blue}
              rollupOthers
            />
            <BreakdownRankCard
              prefix="fault-external"
              title={m.statistika_analytics_faults_by_external()}
              items={byFaults.byExternalParty}
              gradient={STATISTICS_MONO_GRADIENTS.gray}
              rollupOthers
            />
          </div>
        </>
      ) : null}
    </section>
  )
}
