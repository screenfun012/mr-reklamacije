import {
  ClaimKind,
  ClaimOutcome,
  computeAcceptanceRatePercent,
  FaultType,
  roundStatisticsDays,
  STATISTICS_UNKNOWN_CODE,
  type StatisticsAcceptanceRateMonth,
  type StatisticsByFaults,
  type StatisticsCategoryRow,
  type StatisticsCustomerRow,
  type StatisticsDomaceAmounts,
  type StatisticsEmployeeRow,
  type StatisticsEngineTypeRow,
  type StatisticsFaultPartyRow,
  type StatisticsManufacturerRow,
  type StatisticsOutcomeDistribution,
  type StatisticsProcessingTime,
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

interface CategoryRow extends Record<string, unknown> {
  category_id: string | null
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

interface DomaceAmountsRow extends Record<string, unknown> {
  total_amount: number | string | null
  claim_count: number | string
}

interface CustomerRow extends Record<string, unknown> {
  customer_id: string | null
  name: string | null
  total: number | string
  pending: number | string
  accepted: number | string
  rejected: number | string
}

interface FaultAttributionRow extends Record<string, unknown> {
  fault_type: string
  employee_id: string | null
  department_id: string | null
  external_party_id: string | null
  employee_name: string | null
  department_name: string | null
  external_party_name: string | null
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
      code: row.manufacturer_id === null ? STATISTICS_UNKNOWN_CODE : (row.code ?? ''),
      name:
        row.manufacturer_id === null
          ? 'Nepoznato'
          : (row.name ?? row.code ?? STATISTICS_UNKNOWN_CODE),
      total: toInt(row.total),
      pending: toInt(row.pending),
      accepted: toInt(row.accepted),
      rejected: toInt(row.rejected),
    }))
  }

  async fetchByCategory(ctx: StatisticsQueryContext): Promise<StatisticsCategoryRow[]> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT ec.category_id, ec.outcome
        FROM emotive_claims ec
        WHERE ${buildActiveClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT dc.category_id, dc.outcome
        FROM domace_claims dc
        WHERE ${buildActiveClaimWhere('dc', ctx)}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<CategoryRow>(sql`
      SELECT
        c.category_id,
        MAX(cc.code) AS code,
        MAX(cc.name) AS name,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE c.outcome = ${ClaimOutcome.Pending})::int AS pending,
        COUNT(*) FILTER (WHERE c.outcome = ${ClaimOutcome.Accepted})::int AS accepted,
        COUNT(*) FILTER (WHERE c.outcome = ${ClaimOutcome.Rejected})::int AS rejected
      FROM (${unionSql}) AS c
      LEFT JOIN claim_categories cc
        ON cc.id = c.category_id
      GROUP BY c.category_id
      HAVING COUNT(*) > 0
      ORDER BY total DESC, MAX(cc.name) ASC NULLS LAST
    `)

    // The join deliberately does NOT filter deleted_at: a claim keeps the category it was
    // given, so a category the office has since removed must still be named here. Hiding it
    // as "Nepoznato" would be a statement about the claims, and it would be false.
    return result.rows.map((row) => ({
      categoryId: row.category_id,
      code: row.category_id === null ? STATISTICS_UNKNOWN_CODE : (row.code ?? row.category_id),
      name: row.category_id === null ? 'Nepoznato' : (row.name ?? 'Nepoznato'),
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
      code: row.employee_id === null ? STATISTICS_UNKNOWN_CODE : row.employee_id,
      name: row.employee_id === null ? 'Nepoznato' : (row.name ?? STATISTICS_UNKNOWN_CODE),
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
      code: row.engine_type_id === null ? STATISTICS_UNKNOWN_CODE : (row.code ?? ''),
      name:
        row.engine_type_id === null
          ? 'Nepoznato'
          : (row.name ?? row.code ?? STATISTICS_UNKNOWN_CODE),
      total: toInt(row.total),
    }))
  }

  async fetchDomaceAmounts(ctx: StatisticsQueryContext): Promise<StatisticsDomaceAmounts> {
    if (!ctx.effectiveScope.includeDomace) {
      return { totalAmount: 0, claimCount: 0 }
    }

    const result = await this.db.execute<DomaceAmountsRow>(sql`
      SELECT
        COALESCE(SUM(dc.total_amount), 0)::float AS total_amount,
        COUNT(dc.total_amount)::int AS claim_count
      FROM domace_claims dc
      WHERE ${buildActiveClaimWhere('dc', ctx)}
    `)

    const row = result.rows[0]
    if (!row) {
      return { totalAmount: 0, claimCount: 0 }
    }

    return {
      totalAmount: toFloat(row.total_amount) ?? 0,
      claimCount: toInt(row.claim_count),
    }
  }

  async fetchByCustomer(ctx: StatisticsQueryContext): Promise<StatisticsCustomerRow[]> {
    // Emotive-only by design: domace claims carry a free-text customer_name,
    // not a customers FK — the per-partner breakdown mirrors the Excel
    // "REKLAMACIJE PO FIRMAMA" sheet, which is EMOTIVE partners.
    if (!ctx.effectiveScope.includeEmotive) {
      return []
    }

    const result = await this.db.execute<CustomerRow>(sql`
      SELECT
        ec.customer_id,
        MAX(cu.name) AS name,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ec.outcome = ${ClaimOutcome.Pending})::int AS pending,
        COUNT(*) FILTER (WHERE ec.outcome = ${ClaimOutcome.Accepted})::int AS accepted,
        COUNT(*) FILTER (WHERE ec.outcome = ${ClaimOutcome.Rejected})::int AS rejected
      FROM emotive_claims ec
      LEFT JOIN customers cu
        ON cu.id = ec.customer_id
        AND cu.deleted_at IS NULL
      WHERE ${buildActiveClaimWhere('ec', ctx)}
      GROUP BY ec.customer_id
      HAVING COUNT(*) > 0
      ORDER BY total DESC, MAX(cu.name) ASC NULLS LAST
    `)

    return result.rows.map((row) => ({
      customerId: row.customer_id,
      code: row.customer_id === null ? STATISTICS_UNKNOWN_CODE : row.customer_id,
      name: row.customer_id === null ? 'Nepoznato' : (row.name ?? 'Nepoznato'),
      total: toInt(row.total),
      pending: toInt(row.pending),
      accepted: toInt(row.accepted),
      rejected: toInt(row.rejected),
    }))
  }

  async fetchFaultAttribution(ctx: StatisticsQueryContext): Promise<StatisticsByFaults> {
    const branches: SQL[] = []

    if (ctx.effectiveScope.includeEmotive) {
      branches.push(sql`
        SELECT f.fault_type, f.employee_id, f.department_id, f.external_party_id
        FROM emotive_claim_faults f
        JOIN emotive_claims ec ON ec.id = f.claim_id
        WHERE ${buildActiveClaimWhere('ec', ctx)}
      `)
    }

    if (ctx.effectiveScope.includeDomace) {
      branches.push(sql`
        SELECT f.fault_type, f.employee_id, f.department_id, f.external_party_id
        FROM domace_claim_faults f
        JOIN domace_claims dc ON dc.id = f.claim_id
        WHERE ${buildActiveClaimWhere('dc', ctx)}
      `)
    }

    if (branches.length === 0) {
      return { byEmployee: [], byDepartment: [], byExternalParty: [] }
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<FaultAttributionRow>(sql`
      SELECT
        f.fault_type,
        f.employee_id,
        f.department_id,
        f.external_party_id,
        MAX(e.full_name) AS employee_name,
        MAX(d.name_sr) AS department_name,
        MAX(ep.name) AS external_party_name,
        COUNT(*)::int AS total
      FROM (${unionSql}) AS f
      LEFT JOIN employees e
        ON e.id = f.employee_id
        AND e.deleted_at IS NULL
      LEFT JOIN departments d
        ON d.id = f.department_id
        AND d.deleted_at IS NULL
      LEFT JOIN external_parties ep
        ON ep.id = f.external_party_id
        AND ep.deleted_at IS NULL
      GROUP BY f.fault_type, f.employee_id, f.department_id, f.external_party_id
      ORDER BY
        total DESC,
        COALESCE(MAX(e.full_name), MAX(d.name_sr), MAX(ep.name)) ASC NULLS LAST
    `)

    const byEmployee: StatisticsFaultPartyRow[] = []
    const byDepartment: StatisticsFaultPartyRow[] = []
    const byExternalParty: StatisticsFaultPartyRow[] = []

    for (const row of result.rows) {
      const total = toInt(row.total)
      if (row.fault_type === FaultType.Employee && row.employee_id !== null) {
        byEmployee.push({
          id: row.employee_id,
          code: row.employee_id,
          name: row.employee_name ?? 'Nepoznato',
          total,
        })
      } else if (row.fault_type === FaultType.Department && row.department_id !== null) {
        byDepartment.push({
          id: row.department_id,
          code: row.department_id,
          name: row.department_name ?? 'Nepoznato',
          total,
        })
      } else if (row.fault_type === FaultType.External && row.external_party_id !== null) {
        byExternalParty.push({
          id: row.external_party_id,
          code: row.external_party_id,
          name: row.external_party_name ?? 'Nepoznato',
          total,
        })
      }
    }

    return { byEmployee, byDepartment, byExternalParty }
  }
}
