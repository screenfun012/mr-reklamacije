import {
  ClaimKind,
  ClaimOutcome,
  computeAcceptanceRatePercent,
  roundStatisticsDays,
  STATISTICS_TREND_MONTH_COUNT,
  STATISTICS_UNKNOWN_MANUFACTURER_CODE,
  type StatisticsAcceptanceRateMonth,
  type StatisticsManufacturerRow,
  type StatisticsOutcomeDistribution,
  type StatisticsProcessingTime,
  type StatisticsTrendMonth,
  type StatisticsTrendYear,
} from '@mr/shared'
import { sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import type { StatisticsScope } from './statistics.types.js'

interface TrendMonthRow extends Record<string, unknown> {
  month: string
  emotive: number | string
  domace: number | string
  total: number | string
}

interface TrendYearRow extends Record<string, unknown> {
  year: number | string
  emotive: number | string
  domace: number | string
  total: number | string
}

interface ManufacturerRow extends Record<string, unknown> {
  manufacturer_id: string | null
  code: string | null
  name: string | null
  total: number | string
  pending: number | string
  accepted: number | string
  rejected: number | string
}

interface OutcomeDistributionRow extends Record<string, unknown> {
  pending: number | string
  accepted: number | string
  rejected: number | string
  total: number | string
}

interface ProcessingTimeRow extends Record<string, unknown> {
  average_days: number | string | null
  median_days: number | string | null
  max_days: number | string
  sample_size: number | string
}

interface AcceptanceRateMonthRow extends Record<string, unknown> {
  month: string
  decided: number | string
  accepted: number | string
}

function toInt(value: number | string): number {
  return typeof value === 'number' ? value : Number.parseInt(value, 10)
}

function activeEmotiveWhere(alias: string): SQL {
  return sql`${sql.raw(alias)}.deleted_at IS NULL AND ${sql.raw(alias)}.outcome <> ${ClaimOutcome.Archived}`
}

function activeDomaceWhere(alias: string): SQL {
  return sql`${sql.raw(alias)}.deleted_at IS NULL AND ${sql.raw(alias)}.outcome <> ${ClaimOutcome.Archived}`
}

function anchorDate(alias: string): SQL {
  return sql`COALESCE(${sql.raw(alias)}.date_of_claim, (${sql.raw(alias)}.created_at AT TIME ZONE 'UTC')::date)`
}

function trendWindowStart(): SQL {
  return sql`(date_trunc('month', CURRENT_DATE) - (${STATISTICS_TREND_MONTH_COUNT - 1} * interval '1 month'))::date`
}

function toFloat(value: number | string | null): number | null {
  if (value === null) {
    return null
  }

  return typeof value === 'number' ? value : Number.parseFloat(value)
}

function processingDays(alias: string): SQL {
  return sql`GREATEST(0, (${sql.raw(alias)}.outcome_resolved_at::date - ${anchorDate(alias)}))`
}

function resolvedOutcomeWhere(alias: string): SQL {
  return sql`${sql.raw(alias)}.outcome IN (${ClaimOutcome.Accepted}, ${ClaimOutcome.Rejected})
    AND ${sql.raw(alias)}.outcome_resolved_at IS NOT NULL`
}

export class StatisticsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async fetchTrendsByMonth(scope: StatisticsScope): Promise<StatisticsTrendMonth[]> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Emotive}::text AS kind,
          date_trunc('month', ${anchorDate('ec')})::date AS month_start
        FROM emotive_claims ec
        WHERE ${activeEmotiveWhere('ec')}
          AND ${anchorDate('ec')} >= ${trendWindowStart()}
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Domace}::text AS kind,
          date_trunc('month', ${anchorDate('dc')})::date AS month_start
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
          AND ${anchorDate('dc')} >= ${trendWindowStart()}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<TrendMonthRow>(sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - ((${STATISTICS_TREND_MONTH_COUNT} - 1) * interval '1 month'),
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        )::date AS month_start
      ),
      counts AS (
        SELECT
          month_start,
          COUNT(*) FILTER (WHERE kind = ${ClaimKind.Emotive})::int AS emotive,
          COUNT(*) FILTER (WHERE kind = ${ClaimKind.Domace})::int AS domace,
          COUNT(*)::int AS total
        FROM (${unionSql}) AS trend_claims
        GROUP BY month_start
      )
      SELECT
        to_char(m.month_start, 'YYYY-MM') AS month,
        COALESCE(c.emotive, 0)::int AS emotive,
        COALESCE(c.domace, 0)::int AS domace,
        COALESCE(c.total, 0)::int AS total
      FROM months m
      LEFT JOIN counts c ON c.month_start = m.month_start
      ORDER BY m.month_start ASC
    `)

    return result.rows.map((row) => ({
      month: row.month,
      emotive: toInt(row.emotive),
      domace: toInt(row.domace),
      total: toInt(row.total),
    }))
  }

  async fetchTrendsByYear(scope: StatisticsScope): Promise<StatisticsTrendYear[]> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Emotive}::text AS kind,
          ec.claim_year AS claim_year
        FROM emotive_claims ec
        WHERE ${activeEmotiveWhere('ec')}
          AND ${anchorDate('ec')} >= ${trendWindowStart()}
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Domace}::text AS kind,
          dc.claim_year AS claim_year
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
          AND ${anchorDate('dc')} >= ${trendWindowStart()}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<TrendYearRow>(sql`
      SELECT
        claim_year AS year,
        COUNT(*) FILTER (WHERE kind = ${ClaimKind.Emotive})::int AS emotive,
        COUNT(*) FILTER (WHERE kind = ${ClaimKind.Domace})::int AS domace,
        COUNT(*)::int AS total
      FROM (${unionSql}) AS trend_claims
      GROUP BY claim_year
      ORDER BY claim_year ASC
    `)

    return result.rows.map((row) => ({
      year: toInt(row.year),
      emotive: toInt(row.emotive),
      domace: toInt(row.domace),
      total: toInt(row.total),
    }))
  }

  async fetchByManufacturer(scope: StatisticsScope): Promise<StatisticsManufacturerRow[]> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT ec.manufacturer_id, ec.outcome
        FROM emotive_claims ec
        WHERE ${activeEmotiveWhere('ec')}
          AND ${anchorDate('ec')} >= ${trendWindowStart()}
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT dc.manufacturer_id, dc.outcome
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
          AND ${anchorDate('dc')} >= ${trendWindowStart()}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<ManufacturerRow>(sql`
      SELECT
        c.manufacturer_id,
        MAX(em.code) AS code,
        MAX(em.name) AS name,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE c.outcome = ${ClaimOutcome.Pending})::int AS pending,
        COUNT(*) FILTER (WHERE c.outcome = ${ClaimOutcome.Accepted})::int AS accepted,
        COUNT(*) FILTER (WHERE c.outcome = ${ClaimOutcome.Rejected})::int AS rejected
      FROM (${unionSql}) AS c
      LEFT JOIN engine_manufacturers em
        ON em.id = c.manufacturer_id
        AND em.deleted_at IS NULL
      GROUP BY c.manufacturer_id
      HAVING COUNT(*) > 0
      ORDER BY total DESC, MAX(em.name) ASC NULLS LAST
    `)

    return result.rows.map((row) => ({
      manufacturerId: row.manufacturer_id,
      code: row.manufacturer_id === null ? STATISTICS_UNKNOWN_MANUFACTURER_CODE : (row.code ?? ''),
      name:
        row.manufacturer_id === null
          ? 'Nepoznato'
          : (row.name ?? row.code ?? STATISTICS_UNKNOWN_MANUFACTURER_CODE),
      total: toInt(row.total),
      pending: toInt(row.pending),
      accepted: toInt(row.accepted),
      rejected: toInt(row.rejected),
    }))
  }

  async fetchOutcomeDistribution(scope: StatisticsScope): Promise<StatisticsOutcomeDistribution> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT ec.outcome
        FROM emotive_claims ec
        WHERE ${activeEmotiveWhere('ec')}
          AND ${anchorDate('ec')} >= ${trendWindowStart()}
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT dc.outcome
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
          AND ${anchorDate('dc')} >= ${trendWindowStart()}
      `)
    }

    if (branches.length === 0) {
      return { pending: 0, accepted: 0, rejected: 0, total: 0 }
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<OutcomeDistributionRow>(sql`
      SELECT
        COUNT(*) FILTER (WHERE outcome = ${ClaimOutcome.Pending})::int AS pending,
        COUNT(*) FILTER (WHERE outcome = ${ClaimOutcome.Accepted})::int AS accepted,
        COUNT(*) FILTER (WHERE outcome = ${ClaimOutcome.Rejected})::int AS rejected,
        COUNT(*)::int AS total
      FROM (${unionSql}) AS c
    `)

    const row = result.rows[0]
    if (!row) {
      return { pending: 0, accepted: 0, rejected: 0, total: 0 }
    }

    return {
      pending: toInt(row.pending),
      accepted: toInt(row.accepted),
      rejected: toInt(row.rejected),
      total: toInt(row.total),
    }
  }

  async fetchProcessingTime(scope: StatisticsScope): Promise<StatisticsProcessingTime> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT ${processingDays('ec')}::numeric AS processing_days
        FROM emotive_claims ec
        WHERE ${activeEmotiveWhere('ec')}
          AND ${resolvedOutcomeWhere('ec')}
          AND ${anchorDate('ec')} >= ${trendWindowStart()}
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT ${processingDays('dc')}::numeric AS processing_days
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
          AND ${resolvedOutcomeWhere('dc')}
          AND ${anchorDate('dc')} >= ${trendWindowStart()}
      `)
    }

    if (branches.length === 0) {
      return { averageDays: null, medianDays: null, maxDays: 0, sampleSize: 0 }
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<ProcessingTimeRow>(sql`
      SELECT
        AVG(processing_days)::float AS average_days,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY processing_days)::float AS median_days,
        MAX(processing_days)::int AS max_days,
        COUNT(*)::int AS sample_size
      FROM (${unionSql}) AS resolved_claims
    `)

    const row = result.rows[0]
    if (!row || toInt(row.sample_size) === 0) {
      return { averageDays: null, medianDays: null, maxDays: 0, sampleSize: 0 }
    }

    const averageDays = toFloat(row.average_days)
    const medianDays = toFloat(row.median_days)

    return {
      averageDays: averageDays === null ? null : roundStatisticsDays(averageDays),
      medianDays: medianDays === null ? null : roundStatisticsDays(medianDays),
      maxDays: toInt(row.max_days),
      sampleSize: toInt(row.sample_size),
    }
  }

  async fetchAcceptanceRateByMonth(
    scope: StatisticsScope,
  ): Promise<StatisticsAcceptanceRateMonth[]> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT
          date_trunc('month', ec.outcome_resolved_at)::date AS month_start,
          ec.outcome
        FROM emotive_claims ec
        WHERE ${activeEmotiveWhere('ec')}
          AND ${resolvedOutcomeWhere('ec')}
          AND ${anchorDate('ec')} >= ${trendWindowStart()}
          AND ec.outcome_resolved_at >= ${trendWindowStart()}
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT
          date_trunc('month', dc.outcome_resolved_at)::date AS month_start,
          dc.outcome
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
          AND ${resolvedOutcomeWhere('dc')}
          AND ${anchorDate('dc')} >= ${trendWindowStart()}
          AND dc.outcome_resolved_at >= ${trendWindowStart()}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<AcceptanceRateMonthRow>(sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - ((${STATISTICS_TREND_MONTH_COUNT} - 1) * interval '1 month'),
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        )::date AS month_start
      ),
      counts AS (
        SELECT
          month_start,
          COUNT(*)::int AS decided,
          COUNT(*) FILTER (WHERE outcome = ${ClaimOutcome.Accepted})::int AS accepted
        FROM (${unionSql}) AS resolved_claims
        GROUP BY month_start
      )
      SELECT
        to_char(m.month_start, 'YYYY-MM') AS month,
        COALESCE(c.decided, 0)::int AS decided,
        COALESCE(c.accepted, 0)::int AS accepted
      FROM months m
      LEFT JOIN counts c ON c.month_start = m.month_start
      ORDER BY m.month_start ASC
    `)

    return result.rows.map((row) => {
      const decided = toInt(row.decided)
      const accepted = toInt(row.accepted)

      return {
        month: row.month,
        decided,
        accepted,
        ratePercent: computeAcceptanceRatePercent(accepted, decided),
      }
    })
  }
}
