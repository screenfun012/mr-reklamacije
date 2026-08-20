import {
  ClaimKind,
  ClaimOutcome,
  STATISTICS_TREND_MONTH_COUNT,
  type StatisticsSummaryFilters,
} from '@mr/shared'
import { sql, type SQL } from 'drizzle-orm'

import type { StatisticsScope } from './statistics.types.js'

export const StatisticsPeriodMode = {
  Rolling24: 'rolling24',
  Year: 'year',
  Custom: 'custom',
} as const

export type StatisticsPeriodMode = (typeof StatisticsPeriodMode)[keyof typeof StatisticsPeriodMode]

export interface StatisticsPeriod {
  mode: StatisticsPeriodMode
  year?: number
  dateFrom?: string
  dateTo?: string
  monthSeriesStart: SQL
  monthSeriesEnd: SQL
  resolvedRangeStart: SQL
  resolvedRangeEnd?: SQL
}

export interface StatisticsQueryContext {
  effectiveScope: StatisticsScope
  period: StatisticsPeriod
  manufacturerId?: string
  categoryCode?: string
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function anchorDate(alias: string): SQL {
  // emotive_claims.date_of_claim is NOT NULL — the raw column keeps
  // idx_emotive_claims_date_of_claim usable; a COALESCE there would force a
  // full scan for nothing. Domace genuinely needs the created_at fallback.
  if (alias === 'ec') {
    return sql`${sql.raw(alias)}.date_of_claim`
  }
  return sql`COALESCE(${sql.raw(alias)}.date_of_claim, (${sql.raw(alias)}.created_at AT TIME ZONE 'UTC')::date)`
}

function activeClaimWhere(alias: string): SQL {
  return sql`${sql.raw(alias)}.deleted_at IS NULL AND ${sql.raw(alias)}.outcome <> ${ClaimOutcome.Archived}`
}

export function resolveEffectiveScope(
  scope: StatisticsScope,
  filters: StatisticsSummaryFilters,
): StatisticsScope {
  if (filters.kind === ClaimKind.Emotive) {
    return { includeEmotive: scope.includeEmotive, includeDomace: false }
  }

  if (filters.kind === ClaimKind.Domace) {
    return { includeEmotive: false, includeDomace: scope.includeDomace }
  }

  return scope
}

export function resolveStatisticsPeriod(filters: StatisticsSummaryFilters): StatisticsPeriod {
  if (filters.dateFrom !== undefined && filters.dateTo !== undefined) {
    const dateFrom = toIsoDate(filters.dateFrom)
    const dateTo = toIsoDate(filters.dateTo)

    return {
      mode: StatisticsPeriodMode.Custom,
      dateFrom,
      dateTo,
      monthSeriesStart: sql`date_trunc('month', ${dateFrom}::date)::date`,
      monthSeriesEnd: sql`date_trunc('month', ${dateTo}::date)::date`,
      resolvedRangeStart: sql`${dateFrom}::date`,
      resolvedRangeEnd: sql`${dateTo}::date`,
    }
  }

  if (filters.year !== undefined) {
    return {
      mode: StatisticsPeriodMode.Year,
      year: filters.year,
      monthSeriesStart: sql`make_date(${filters.year}, 1, 1)`,
      monthSeriesEnd: sql`make_date(${filters.year}, 12, 1)`,
      resolvedRangeStart: sql`make_date(${filters.year}, 1, 1)`,
      resolvedRangeEnd: sql`make_date(${filters.year}, 12, 31)`,
    }
  }

  return {
    mode: StatisticsPeriodMode.Rolling24,
    monthSeriesStart: sql`(date_trunc('month', CURRENT_DATE) - ((${STATISTICS_TREND_MONTH_COUNT} - 1) * interval '1 month'))::date`,
    monthSeriesEnd: sql`date_trunc('month', CURRENT_DATE)::date`,
    resolvedRangeStart: sql`(date_trunc('month', CURRENT_DATE) - ((${STATISTICS_TREND_MONTH_COUNT} - 1) * interval '1 month'))::date`,
  }
}

export function buildStatisticsQueryContext(
  scope: StatisticsScope,
  filters: StatisticsSummaryFilters,
): StatisticsQueryContext {
  const ctx: StatisticsQueryContext = {
    effectiveScope: resolveEffectiveScope(scope, filters),
    period: resolveStatisticsPeriod(filters),
  }

  if (filters.manufacturerId !== undefined) {
    ctx.manufacturerId = filters.manufacturerId
  }

  if (filters.categoryCode !== undefined) {
    ctx.categoryCode = filters.categoryCode
  }

  return ctx
}

export function buildActiveClaimWhere(alias: string, ctx: StatisticsQueryContext): SQL {
  const conditions: SQL[] = [activeClaimWhere(alias)]

  if (ctx.period.mode === StatisticsPeriodMode.Year && ctx.period.year !== undefined) {
    conditions.push(sql`${sql.raw(alias)}.claim_year = ${ctx.period.year}`)
  } else {
    conditions.push(sql`${anchorDate(alias)} >= ${ctx.period.monthSeriesStart}`)

    if (ctx.period.mode === StatisticsPeriodMode.Custom && ctx.period.dateTo !== undefined) {
      conditions.push(sql`${anchorDate(alias)} <= ${ctx.period.dateTo}::date`)
    }
  }

  if (ctx.manufacturerId !== undefined) {
    conditions.push(sql`${sql.raw(alias)}.manufacturer_id = ${ctx.manufacturerId}`)
  }

  if (ctx.categoryCode !== undefined) {
    // Every section of the summary is built on this function, so the category is honoured by
    // all of them at once — including the ones that know nothing about categories. Semi-join
    // on the CODE, exactly as the claims list does (spec §4.2): an unknown code counts nothing.
    conditions.push(sql`${sql.raw(alias)}.category_id IN (
      SELECT id FROM claim_categories WHERE code = ${ctx.categoryCode} AND deleted_at IS NULL
    )`)
  }

  return sql.join(conditions, sql` AND `)
}

export function processingDays(alias: string): SQL {
  return sql`GREATEST(0, (${sql.raw(alias)}.outcome_resolved_at::date - ${anchorDate(alias)}))`
}

function resolvedOutcomeWhere(alias: string): SQL {
  return sql`${sql.raw(alias)}.outcome IN (${ClaimOutcome.Accepted}, ${ClaimOutcome.Rejected})
    AND ${sql.raw(alias)}.outcome_resolved_at IS NOT NULL`
}

export function buildResolvedClaimWhere(alias: string, ctx: StatisticsQueryContext): SQL {
  // Half-open range on the raw timestamptz column — casting the COLUMN
  // (`::date`) would make idx_*_outcome_resolved_at unusable. Comparing
  // against `date::timestamptz` boundaries is semantically identical.
  const conditions: SQL[] = [
    buildActiveClaimWhere(alias, ctx),
    resolvedOutcomeWhere(alias),
    sql`${sql.raw(alias)}.outcome_resolved_at >= ${ctx.period.resolvedRangeStart}::date::timestamptz`,
  ]

  if (ctx.period.resolvedRangeEnd !== undefined) {
    conditions.push(
      sql`${sql.raw(alias)}.outcome_resolved_at < (${ctx.period.resolvedRangeEnd}::date + 1)::timestamptz`,
    )
  }

  return sql.join(conditions, sql` AND `)
}
