import {
  ClaimKind,
  ClaimOutcome,
  STATISTICS_TREND_MONTH_COUNT,
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
}
