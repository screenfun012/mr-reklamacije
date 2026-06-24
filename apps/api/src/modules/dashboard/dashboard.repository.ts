import { ClaimKind, ClaimOutcome, type DashboardSummary } from '@mr/shared'
import { sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import type { DashboardScope } from './dashboard.types.js'

const OVERDUE_DAYS_THRESHOLD = 7
const LIST_LIMIT = 20
const CHART_MONTH_COUNT = 6

interface StatsRow extends Record<string, unknown> {
  total: number | string
  pending: number | string
  accepted: number | string
  rejected: number | string
  new_this_month: number | string
  emotive_count: number | string
  domace_count: number | string
}

interface ListRow extends Record<string, unknown> {
  kind: string
  id: string
  mr_number: string | null
  customer_label: string | null
  days_open: number | string
}

interface ChartRow extends Record<string, unknown> {
  month: string
  emotive: number | string
  domace: number | string
  total: number | string
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

function mapListRow(row: ListRow): DashboardSummary['overdue'][number] {
  return {
    kind: row.kind as DashboardSummary['overdue'][number]['kind'],
    id: row.id,
    mrNumber: row.mr_number,
    customerLabel: row.customer_label,
    daysOpen: toInt(row.days_open),
  }
}

export class DashboardRepository {
  constructor(private readonly db: ApiDatabase) {}

  async getSummary(scope: DashboardScope): Promise<DashboardSummary> {
    const [stats, overdue, recent, chart] = await Promise.all([
      this.fetchStats(scope),
      this.fetchOverdue(scope),
      this.fetchRecent(scope),
      this.fetchChart(scope),
    ])

    return {
      stats,
      overdue,
      recent,
      chart,
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
          (CURRENT_DATE - ${anchorDate('ec')})::int AS days_open
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
          (CURRENT_DATE - ${anchorDate('dc')})::int AS days_open
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

    const result = await this.db.execute<ListRow>(sql`
      SELECT kind, id, mr_number, customer_label, days_open
      FROM (${unionSql}) AS overdue_claims
      ORDER BY days_open DESC, id DESC
      LIMIT ${LIST_LIMIT}
    `)

    return result.rows.map(mapListRow)
  }

  private async fetchRecent(scope: DashboardScope): Promise<DashboardSummary['recent']> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Emotive}::text AS kind,
          ec.id,
          ec.mr_number,
          c.name AS customer_label,
          (CURRENT_DATE - (ec.created_at AT TIME ZONE 'UTC')::date)::int AS days_open
        FROM emotive_claims ec
        LEFT JOIN customers c ON c.id = ec.customer_id
        WHERE ${activeEmotiveWhere('ec')}
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Domace}::text AS kind,
          dc.id,
          dc.mr_number,
          dc.customer_name AS customer_label,
          (CURRENT_DATE - (dc.created_at AT TIME ZONE 'UTC')::date)::int AS days_open
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<ListRow>(sql`
      SELECT kind, id, mr_number, customer_label, days_open
      FROM (${unionSql}) AS recent_claims
      ORDER BY days_open ASC, id DESC
      LIMIT ${LIST_LIMIT}
    `)

    return result.rows.map(mapListRow)
  }

  private async fetchChart(scope: DashboardScope): Promise<DashboardSummary['chart']> {
    const branches: SQL[] = []

    if (scope.includeEmotive) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Emotive}::text AS kind,
          date_trunc('month', ec.created_at AT TIME ZONE 'UTC')::date AS month_start
        FROM emotive_claims ec
        WHERE ${activeEmotiveWhere('ec')}
          AND ec.created_at >= (date_trunc('month', CURRENT_DATE) - (${CHART_MONTH_COUNT - 1} * interval '1 month'))
      `)
    }

    if (scope.includeDomace) {
      branches.push(sql`
        SELECT
          ${ClaimKind.Domace}::text AS kind,
          date_trunc('month', dc.created_at AT TIME ZONE 'UTC')::date AS month_start
        FROM domace_claims dc
        WHERE ${activeDomaceWhere('dc')}
          AND dc.created_at >= (date_trunc('month', CURRENT_DATE) - (${CHART_MONTH_COUNT - 1} * interval '1 month'))
      `)
    }

    if (branches.length === 0) {
      return []
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)

    const result = await this.db.execute<ChartRow>(sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - (${CHART_MONTH_COUNT - 1} * interval '1 month'),
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
        FROM (${unionSql}) AS chart_claims
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
}
