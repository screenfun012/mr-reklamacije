import { schema } from '@mr/db'
import { ClaimKind, ClaimOutcome, type ClientPortalStats, type DashboardSummary } from '@mr/shared'
import { eq, sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import type { DashboardScope } from './dashboard.types.js'

const { customerUsers } = schema

const OVERDUE_DAYS_THRESHOLD = 7
const LIST_LIMIT = 20
const CHART_MONTH_COUNT = 6

interface StatsRow extends Record<string, unknown> {
  total: number | string
  pending: number | string
  accepted: number | string
  rejected: number | string
  new_this_month: number | string
  new_last_month: number | string
  pending_new_this_month: number | string
  pending_new_last_month: number | string
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
  // emotive_claims.date_of_claim is NOT NULL — raw column keeps its index
  // usable; domace genuinely needs the created_at fallback.
  if (alias === 'ec') {
    return sql`${sql.raw(alias)}.date_of_claim`
  }
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

interface ClientStatsRow extends Record<string, unknown> {
  received: number | string
  in_progress: number | string
  resolved: number | string
  total: number | string
}

export interface ClientClaimAuditRow {
  claimId: string
  mrNumber: string | null
  claimNumber: string | null
  action: string
  changes: unknown
  occurredAt: Date
  // Phase 2 visibility gate: null while the claim is still private.
  publishedAt: Date | null
}

interface ClientClaimAuditDbRow extends Record<string, unknown> {
  claim_id: string
  mr_number: string | null
  claim_number: string | null
  action: string
  changes: unknown
  // Raw execute() returns timestamptz as either Date or pg text form.
  occurred_at: Date | string
  published_at: Date | string | null
}

/** `null` = unrestricted (internal full-view actor); a list = own-customer scope. */
function clientCustomerFilter(customerIds: string[] | null): SQL {
  if (customerIds === null) {
    return sql`TRUE`
  }
  return sql`ec.customer_id IN (${sql.join(
    customerIds.map((id) => sql`${id}`),
    sql`, `,
  )})`
}

export class DashboardRepository {
  constructor(private readonly db: ApiDatabase) {}

  async getUserCustomerIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ customerId: customerUsers.customerId })
      .from(customerUsers)
      .where(eq(customerUsers.userId, userId))

    return rows.map((row) => row.customerId)
  }

  /**
   * Portal phase counts across all of the scope's EMOTIVE claims (clients have
   * no domace claims). Mirrors `deriveClientClaimPhase` (Phase 2 visibility
   * gate, 2026-07-18): a decided outcome only counts as "resolved" once
   * `published_at` is set — a claim decided internally but still private
   * falls back into "in progress", same as a pending claim. "received" stays
   * the running total of everything the workshop has taken in (that doesn't
   * leak the outcome). Archived claims are invisible to clients everywhere.
   */
  async getClientStats(customerIds: string[] | null): Promise<ClientPortalStats> {
    const result = await this.db.execute<ClientStatsRow>(sql`
      SELECT
        count(*)::int AS received,
        count(*) FILTER (
          WHERE ec.outcome = ${ClaimOutcome.Pending}
            OR (ec.outcome IN (${ClaimOutcome.Accepted}, ${ClaimOutcome.Rejected}) AND ec.published_at IS NULL)
        )::int AS in_progress,
        count(*) FILTER (
          WHERE ec.published_at IS NOT NULL
            AND ec.outcome IN (${ClaimOutcome.Accepted}, ${ClaimOutcome.Rejected})
        )::int AS resolved,
        count(*)::int AS total
      FROM emotive_claims ec
      WHERE ${activeEmotiveWhere('ec')} AND ${clientCustomerFilter(customerIds)}
    `)

    const row = result.rows[0]
    return {
      received: row === undefined ? 0 : toInt(row.received),
      inProgress: row === undefined ? 0 : toInt(row.in_progress),
      resolved: row === undefined ? 0 : toInt(row.resolved),
      total: row === undefined ? 0 : toInt(row.total),
    }
  }

  /**
   * Recent audit rows for the scope's claims, newest first. Only the columns
   * needed to DERIVE feed events leave this query; the service projects them
   * down further — audit internals (actor, IP, diffs) never reach a client.
   */
  async getClientClaimAuditRows(
    customerIds: string[] | null,
    limit: number,
  ): Promise<ClientClaimAuditRow[]> {
    const result = await this.db.execute<ClientClaimAuditDbRow>(sql`
      SELECT
        al.entity_id AS claim_id,
        ec.mr_number,
        ec.claim_number,
        al.action,
        al.changes,
        al.created_at AS occurred_at,
        ec.published_at AS published_at
      FROM audit_log al
      INNER JOIN emotive_claims ec ON ec.id = al.entity_id
      WHERE al.entity_type = 'emotive_claim'
        AND al.action IN ('create', 'update')
        AND ${activeEmotiveWhere('ec')}
        AND ${clientCustomerFilter(customerIds)}
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `)

    return result.rows.map((row) => ({
      claimId: row.claim_id,
      mrNumber: row.mr_number,
      claimNumber: row.claim_number,
      action: row.action,
      changes: row.changes,
      occurredAt: row.occurred_at instanceof Date ? row.occurred_at : new Date(row.occurred_at),
      publishedAt:
        row.published_at === null
          ? null
          : row.published_at instanceof Date
            ? row.published_at
            : new Date(row.published_at),
    }))
  }

  async getSummary(scope: DashboardScope): Promise<DashboardSummary> {
    const [statsBundle, overdue, recent, chart] = await Promise.all([
      this.fetchStats(scope),
      this.fetchOverdue(scope),
      this.fetchRecent(scope),
      this.fetchChart(scope),
    ])

    return {
      stats: statsBundle.stats,
      trends: statsBundle.trends,
      overdue,
      recent,
      chart,
    }
  }

  private async fetchStats(scope: DashboardScope): Promise<{
    stats: DashboardSummary['stats']
    trends: DashboardSummary['trends']
  }> {
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
      const emptyTrend = { previous: 0, delta: 0 }
      return {
        stats: {
          total: 0,
          pending: 0,
          accepted: 0,
          rejected: 0,
          newThisMonth: 0,
          byKind: { emotive: 0, domace: 0 },
        },
        trends: {
          newThisMonth: emptyTrend,
          pending: emptyTrend,
        },
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
        COUNT(*) FILTER (
          WHERE anchor_date >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date
            AND anchor_date < date_trunc('month', CURRENT_DATE)::date
        )::int AS new_last_month,
        COUNT(*) FILTER (
          WHERE outcome = ${ClaimOutcome.Pending}
            AND anchor_date >= date_trunc('month', CURRENT_DATE)::date
        )::int AS pending_new_this_month,
        COUNT(*) FILTER (
          WHERE outcome = ${ClaimOutcome.Pending}
            AND anchor_date >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date
            AND anchor_date < date_trunc('month', CURRENT_DATE)::date
        )::int AS pending_new_last_month,
        COUNT(*) FILTER (WHERE kind = ${ClaimKind.Emotive})::int AS emotive_count,
        COUNT(*) FILTER (WHERE kind = ${ClaimKind.Domace})::int AS domace_count
      FROM (${unionSql}) AS active_claims
    `)

    const row = result.rows[0]
    const newThisMonth = toInt(row?.new_this_month ?? 0)
    const newLastMonth = toInt(row?.new_last_month ?? 0)
    const pendingNewThisMonth = toInt(row?.pending_new_this_month ?? 0)
    const pendingNewLastMonth = toInt(row?.pending_new_last_month ?? 0)

    return {
      stats: {
        total: toInt(row?.total ?? 0),
        pending: toInt(row?.pending ?? 0),
        accepted: toInt(row?.accepted ?? 0),
        rejected: toInt(row?.rejected ?? 0),
        newThisMonth,
        byKind: {
          emotive: toInt(row?.emotive_count ?? 0),
          domace: toInt(row?.domace_count ?? 0),
        },
      },
      trends: {
        newThisMonth: {
          previous: newLastMonth,
          delta: newThisMonth - newLastMonth,
        },
        pending: {
          previous: pendingNewLastMonth,
          delta: pendingNewThisMonth - pendingNewLastMonth,
        },
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
          (CURRENT_DATE - (ec.created_at AT TIME ZONE 'UTC')::date)::int AS days_open,
          ec.created_at
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
          (CURRENT_DATE - (dc.created_at AT TIME ZONE 'UTC')::date)::int AS days_open,
          dc.created_at
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
      ORDER BY created_at DESC, id DESC
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
