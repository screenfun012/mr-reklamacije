import { ClaimKind, ClaimOutcome, type DashboardSummary } from '@mr/shared'
import { sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import type { DashboardScope } from './dashboard.types.js'

const OVERDUE_DAYS_THRESHOLD = 7
const OVERDUE_LIST_LIMIT = 20

interface StatsRow extends Record<string, unknown> {
  total: number | string
  pending: number | string
  accepted: number | string
  rejected: number | string
  new_this_month: number | string
  emotive_count: number | string
  domace_count: number | string
}

interface OverdueRow extends Record<string, unknown> {
  kind: string
  id: string
  mr_number: string | null
  customer_label: string | null
  days_open: number | string
  outcome: string
  date_of_claim: Date | string | null
}

function toInt(value: number | string): number {
  return typeof value === 'number' ? value : Number.parseInt(value, 10)
}

function formatDate(value: Date | string | null): string | null {
  if (value === null) {
    return null
  }
  if (typeof value === 'string') {
    return value.slice(0, 10)
  }
  return value.toISOString().slice(0, 10)
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

export class DashboardRepository {
  constructor(private readonly db: ApiDatabase) {}

  async getSummary(scope: DashboardScope): Promise<DashboardSummary> {
    const [stats, overdue] = await Promise.all([this.fetchStats(scope), this.fetchOverdue(scope)])

    return {
      stats,
      overdue,
      recent: [],
    }
  }

  private async fetchStats(scope: DashboardScope): Promise<DashboardSummary['stats']> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT
          ec.outcome,
          ${ClaimKind.Emotive}::text AS kind,
          ${anchorDate('ec')} AS anchor_date
        FROM emotive_claims ec
        WHERE ${activeEmotiveWhere('ec')}
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT
          dc.outcome,
          ${ClaimKind.Domace}::text AS kind,
          ${anchorDate('dc')} AS anchor_date
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
      `)
    }

    if (branches.length === 0) {
      return {
        total: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
        newThisMonth: 0,
        byKind: { emotive: 0, domace: 0 },
      }
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<StatsRow>(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE outcome = ${ClaimOutcome.Pending})::int AS pending,
        COUNT(*) FILTER (WHERE outcome = ${ClaimOutcome.Accepted})::int AS accepted,
        COUNT(*) FILTER (WHERE outcome = ${ClaimOutcome.Rejected})::int AS rejected,
        COUNT(*) FILTER (
          WHERE anchor_date >= date_trunc('month', CURRENT_DATE)::date
        )::int AS new_this_month,
        COUNT(*) FILTER (WHERE kind = ${ClaimKind.Emotive})::int AS emotive_count,
        COUNT(*) FILTER (WHERE kind = ${ClaimKind.Domace})::int AS domace_count
      FROM (${unionSql}) AS active_claims
    `)

    const row = result.rows[0]
    return {
      total: toInt(row?.total ?? 0),
      pending: toInt(row?.pending ?? 0),
      accepted: toInt(row?.accepted ?? 0),
      rejected: toInt(row?.rejected ?? 0),
      newThisMonth: toInt(row?.new_this_month ?? 0),
      byKind: {
        emotive: toInt(row?.emotive_count ?? 0),
        domace: toInt(row?.domace_count ?? 0),
      },
    }
  }

  private async fetchOverdue(scope: DashboardScope): Promise<DashboardSummary['overdue']> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Emotive}::text AS kind,
          ec.id,
          ec.mr_number,
          c.name AS customer_label,
          (CURRENT_DATE - ${anchorDate('ec')})::int AS days_open,
          ec.outcome,
          ec.date_of_claim
        FROM emotive_claims ec
        LEFT JOIN customers c ON c.id = ec.customer_id
        WHERE ${activeEmotiveWhere('ec')}
          AND ec.outcome = ${ClaimOutcome.Pending}
          AND (CURRENT_DATE - ${anchorDate('ec')}) > ${OVERDUE_DAYS_THRESHOLD}
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Domace}::text AS kind,
          dc.id,
          dc.mr_number,
          dc.customer_name AS customer_label,
          (CURRENT_DATE - ${anchorDate('dc')})::int AS days_open,
          dc.outcome,
          dc.date_of_claim
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
          AND dc.outcome = ${ClaimOutcome.Pending}
          AND (CURRENT_DATE - ${anchorDate('dc')}) > ${OVERDUE_DAYS_THRESHOLD}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<OverdueRow>(sql`
      SELECT kind, id, mr_number, customer_label, days_open, outcome, date_of_claim
      FROM (${unionSql}) AS overdue_claims
      ORDER BY days_open DESC, date_of_claim ASC NULLS LAST, id DESC
      LIMIT ${OVERDUE_LIST_LIMIT}
    `)

    return result.rows.map((row) => ({
      kind: row.kind as DashboardSummary['overdue'][number]['kind'],
      id: row.id,
      mrNumber: row.mr_number,
      customerLabel: row.customer_label,
      daysOpen: toInt(row.days_open),
      outcome: ClaimOutcome.Pending,
      dateOfClaim: formatDate(row.date_of_claim),
    }))
  }
}
