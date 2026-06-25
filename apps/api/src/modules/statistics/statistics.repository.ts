import {
  ClaimKind,
  ClaimOutcome,
  computeAcceptanceRatePercent,
  roundStatisticsDays,
  STATISTICS_UNKNOWN_MANUFACTURER_CODE,
  type StatisticsAcceptanceRateMonth,
  type StatisticsEmployeeRow,
  type StatisticsEngineTypeRow,
  type StatisticsManufacturerRow,
  type StatisticsOutcomeDistribution,
  type StatisticsProcessingTime,
  type StatisticsSourceRow,
  type StatisticsTrendMonth,
  type StatisticsTrendYear,
} from '@mr/shared'
import { sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import {
  anchorDate,
  buildActiveClaimWhere,
  buildResolvedClaimWhere,
  processingDays,
  type StatisticsQueryContext,
} from './statistics-claim-filter.js'

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

interface SourceRow extends Record<string, unknown> {
  source_id: string | null
  code: string | null
  name: string | null
  total: number | string
}

interface EmployeeRow extends Record<string, unknown> {
  employee_id: string | null
  name: string | null
  total: number | string
}

interface EngineTypeRow extends Record<string, unknown> {
  engine_type_id: string | null
  code: string | null
  name: string | null
  total: number | string
}

function toInt(value: number | string): number {
  return typeof value === 'number' ? value : Number.parseInt(value, 10)
}

function toFloat(value: number | string | null): number | null {
  if (value === null) {
    return null
  }

  return typeof value === 'number' ? value : Number.parseFloat(value)
}

export class StatisticsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async fetchTrendsByMonth(ctx: StatisticsQueryContext): Promise<StatisticsTrendMonth[]> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Emotive}::text AS kind,
          date_trunc('month', ${anchorDate('ec')})::date AS month_start
        FROM emotive_claims ec
        WHERE ${buildActiveClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Domace}::text AS kind,
          date_trunc('month', ${anchorDate('dc')})::date AS month_start
        FROM domace_claims dc
        WHERE ${buildActiveClaimWhere('dc', ctx)}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<TrendMonthRow>(sql`
      WITH months AS (
        SELECT generate_series(
          ${ctx.period.monthSeriesStart},
          ${ctx.period.monthSeriesEnd},
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

  async fetchTrendsByYear(ctx: StatisticsQueryContext): Promise<StatisticsTrendYear[]> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Emotive}::text AS kind,
          ec.claim_year AS claim_year
        FROM emotive_claims ec
        WHERE ${buildActiveClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Domace}::text AS kind,
          dc.claim_year AS claim_year
        FROM domace_claims dc
        WHERE ${buildActiveClaimWhere('dc', ctx)}
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

  async fetchByManufacturer(ctx: StatisticsQueryContext): Promise<StatisticsManufacturerRow[]> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT ec.manufacturer_id, ec.outcome
        FROM emotive_claims ec
        WHERE ${buildActiveClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT dc.manufacturer_id, dc.outcome
        FROM domace_claims dc
        WHERE ${buildActiveClaimWhere('dc', ctx)}
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

  async fetchOutcomeDistribution(
    ctx: StatisticsQueryContext,
  ): Promise<StatisticsOutcomeDistribution> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT ec.outcome
        FROM emotive_claims ec
        WHERE ${buildActiveClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT dc.outcome
        FROM domace_claims dc
        WHERE ${buildActiveClaimWhere('dc', ctx)}
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

  async fetchProcessingTime(ctx: StatisticsQueryContext): Promise<StatisticsProcessingTime> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT ${processingDays('ec')}::numeric AS processing_days
        FROM emotive_claims ec
        WHERE ${buildResolvedClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT ${processingDays('dc')}::numeric AS processing_days
        FROM domace_claims dc
        WHERE ${buildResolvedClaimWhere('dc', ctx)}
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
    ctx: StatisticsQueryContext,
  ): Promise<StatisticsAcceptanceRateMonth[]> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT
          date_trunc('month', ec.outcome_resolved_at)::date AS month_start,
          ec.outcome
        FROM emotive_claims ec
        WHERE ${buildResolvedClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT
          date_trunc('month', dc.outcome_resolved_at)::date AS month_start,
          dc.outcome
        FROM domace_claims dc
        WHERE ${buildResolvedClaimWhere('dc', ctx)}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<AcceptanceRateMonthRow>(sql`
      WITH months AS (
        SELECT generate_series(
          ${ctx.period.monthSeriesStart},
          ${ctx.period.monthSeriesEnd},
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

  async fetchBySource(ctx: StatisticsQueryContext): Promise<StatisticsSourceRow[]> {
    if (!ctx.effectiveScope.includeEmotive) {
      return []
    }

    const result = await this.db.execute<SourceRow>(sql`
      SELECT
        ec.source_id,
        MAX(cs.code) AS code,
        MAX(cs.name) AS name,
        COUNT(*)::int AS total
      FROM emotive_claims ec
      LEFT JOIN claim_sources cs
        ON cs.id = ec.source_id
        AND cs.deleted_at IS NULL
      WHERE ${buildActiveClaimWhere('ec', ctx)}
      GROUP BY ec.source_id
      HAVING COUNT(*) > 0
      ORDER BY total DESC, MAX(cs.name) ASC NULLS LAST
    `)

    return result.rows.map((row) => ({
      sourceId: row.source_id,
      code: row.source_id === null ? STATISTICS_UNKNOWN_MANUFACTURER_CODE : (row.code ?? ''),
      name:
        row.source_id === null
          ? 'Nepoznato'
          : (row.name ?? row.code ?? STATISTICS_UNKNOWN_MANUFACTURER_CODE),
      total: toInt(row.total),
    }))
  }

  async fetchByEmployee(ctx: StatisticsQueryContext): Promise<StatisticsEmployeeRow[]> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT ec.employee_id
        FROM emotive_claims ec
        WHERE ${buildActiveClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT dc.employee_id
        FROM domace_claims dc
        WHERE ${buildActiveClaimWhere('dc', ctx)}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<EmployeeRow>(sql`
      SELECT
        c.employee_id,
        MAX(e.full_name) AS name,
        COUNT(*)::int AS total
      FROM (${unionSql}) AS c
      LEFT JOIN employees e
        ON e.id = c.employee_id
        AND e.deleted_at IS NULL
      GROUP BY c.employee_id
      HAVING COUNT(*) > 0
      ORDER BY total DESC, MAX(e.full_name) ASC NULLS LAST
    `)

    return result.rows.map((row) => ({
      employeeId: row.employee_id,
      code: row.employee_id === null ? STATISTICS_UNKNOWN_MANUFACTURER_CODE : row.employee_id,
      name:
        row.employee_id === null ? 'Nepoznato' : (row.name ?? STATISTICS_UNKNOWN_MANUFACTURER_CODE),
      total: toInt(row.total),
    }))
  }

  async fetchByEngineType(ctx: StatisticsQueryContext): Promise<StatisticsEngineTypeRow[]> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT ec.engine_type_id
        FROM emotive_claims ec
        WHERE ${buildActiveClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT dc.engine_type_id
        FROM domace_claims dc
        WHERE ${buildActiveClaimWhere('dc', ctx)}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<EngineTypeRow>(sql`
      SELECT
        c.engine_type_id,
        MAX(et.code) AS code,
        MAX(et.code) AS name,
        COUNT(*)::int AS total
      FROM (${unionSql}) AS c
      LEFT JOIN engine_types et
        ON et.id = c.engine_type_id
        AND et.deleted_at IS NULL
      GROUP BY c.engine_type_id
      HAVING COUNT(*) > 0
      ORDER BY total DESC, MAX(et.code) ASC NULLS LAST
    `)

    return result.rows.map((row) => ({
      engineTypeId: row.engine_type_id,
      code: row.engine_type_id === null ? STATISTICS_UNKNOWN_MANUFACTURER_CODE : (row.code ?? ''),
      name:
        row.engine_type_id === null
          ? 'Nepoznato'
          : (row.name ?? row.code ?? STATISTICS_UNKNOWN_MANUFACTURER_CODE),
      total: toInt(row.total),
    }))
  }
}
