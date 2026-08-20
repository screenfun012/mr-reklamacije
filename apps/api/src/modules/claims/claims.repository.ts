import { schema } from '@mr/db'
import {
  ClaimFreshness,
  ClaimKind,
  ClaimOutcome,
  type ClaimListItem,
  type DomaceClaimListItem,
  type EmotiveClaimListItem,
} from '@mr/shared'
import { eq, sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { buildClaimListOrderBy } from './claim-list-order.js'
import type { ClaimsListScope } from './claims.types.js'
import type { ClaimListQuery, ClaimListResponse } from './claims.validators.js'

const { customerUsers } = schema

/**
 * Prefix full-text query for the claims search box. `websearch_to_tsquery` only
 * matches whole tokens, and the 'simple' parser keeps an MR number like
 * "5376/26" as ONE token — so typing "5376" (or any partial) matched nothing.
 * Tokenizing the term the same way and appending `:*` gives prefix matching
 * ("5376"→"5376/26", "Bos"→"Bosch"), while the indexed `to_tsvector('simple', …)`
 * expression stays textually identical, so the existing GIN search indexes still
 * apply. Returns a NULL tsquery for a term with no lexemes (matches nothing).
 */
function searchPrefixTsQuery(term: string): SQL {
  return sql`(SELECT string_agg(quote_literal(lexeme) || ':*', ' & ') FROM unnest(to_tsvector('simple', ${term})))::tsquery`
}

interface UnifiedListRow {
  [key: string]: unknown
  kind: string
  id: string
  sequence_number: number | string
  claim_number: string | null
  customer_name: string | null
  warranty_report: string | null
  engine_type_id: string | null
  engine_type_code: string | null
  manufacturer_id: string | null
  manufacturer_name: string | null
  category_id: string | null
  category_code: string | null
  category_name: string | null
  engine_code: string | null
  date_of_claim: Date | string | null
  mr_number: string | null
  date_of_finish: Date | string | null
  employee_id: string | null
  employee_name: string | null
  source_id: string | null
  customer_id: string | null
  outcome: string
  claim_year: number | string
  total_amount: string | number | null
  created_at: Date
  client_visible_at: Date | string | null
  published_at: Date | string | null
  freshness: string | null
}

function formatDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value
  }
  return value.toISOString().slice(0, 10)
}

function formatTimestamp(value: Date | string): string {
  if (typeof value === 'string') {
    return value
  }
  return value.toISOString()
}

function toInt(value: number | string): number {
  return typeof value === 'number' ? value : Number.parseInt(value, 10)
}

/**
 * The kind of work the claim is about. `null` for a legacy row that predates the column —
 * create and update both require it, so a claim written through the API always carries one.
 */
function mapCategory(row: UnifiedListRow): ClaimListItem['category'] {
  if (row.category_id === null || row.category_code === null || row.category_name === null) {
    return null
  }
  return { id: row.category_id, code: row.category_code, name: row.category_name }
}

function mapUnifiedRow(row: UnifiedListRow): ClaimListItem {
  if (row.kind === ClaimKind.Domace) {
    const item: DomaceClaimListItem = {
      kind: ClaimKind.Domace,
      id: row.id,
      sequenceNumber: toInt(row.sequence_number),
      claimNumber: row.claim_number,
      customerName: row.customer_name,
      warrantyReport: row.warranty_report,
      engineTypeId: row.engine_type_id,
      engineTypeCode: row.engine_type_code,
      manufacturerId: row.manufacturer_id,
      manufacturerName: row.manufacturer_name,
      engineCode: row.engine_code,
      dateOfClaim: row.date_of_claim === null ? null : formatDate(row.date_of_claim),
      mrNumber: row.mr_number,
      dateOfFinish: row.date_of_finish === null ? null : formatDate(row.date_of_finish),
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      outcome: row.outcome as DomaceClaimListItem['outcome'],
      claimYear: toInt(row.claim_year),
      totalAmount: row.total_amount === null ? null : Number(row.total_amount),
      category: mapCategory(row),
      createdAt: formatTimestamp(row.created_at),
    }
    return item
  }

  const clientVisibleAt =
    row.client_visible_at === null ? null : formatTimestamp(row.client_visible_at)
  const publishedAt = row.published_at === null ? null : formatTimestamp(row.published_at)

  const item: EmotiveClaimListItem = {
    kind: ClaimKind.Emotive,
    id: row.id,
    sequenceNumber: toInt(row.sequence_number),
    claimNumber: row.claim_number,
    warrantyReport: row.warranty_report,
    engineTypeId: row.engine_type_id ?? '',
    engineTypeCode: row.engine_type_code ?? '',
    manufacturerId: row.manufacturer_id,
    manufacturerName: row.manufacturer_name,
    engineCode: row.engine_code,
    dateOfClaim: formatDate(row.date_of_claim ?? row.created_at),
    mrNumber: row.mr_number ?? '',
    dateOfFinish: row.date_of_finish === null ? null : formatDate(row.date_of_finish),
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    sourceId: row.source_id,
    outcome: row.outcome as EmotiveClaimListItem['outcome'],
    claimYear: toInt(row.claim_year),
    customerId: row.customer_id,
    customerName: row.customer_name,
    category: mapCategory(row),
    createdAt: formatTimestamp(row.created_at),
    clientVisibleAt,
    publishedAt,
    freshness: row.freshness as EmotiveClaimListItem['freshness'],
  }
  return item
}

export class ClaimsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async getUserCustomerIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ customerId: customerUsers.customerId })
      .from(customerUsers)
      .where(eq(customerUsers.userId, userId))

    return rows.map((row) => row.customerId)
  }

  async list(query: ClaimListQuery, scope: ClaimsListScope): Promise<ClaimListResponse> {
    const branches = await this.buildUnionBranches(query, scope)
    if (branches.length === 0) {
      return { items: [], total: 0, page: query.page, pageSize: query.pageSize }
    }

    const unionSql = sql.join(branches, sql` UNION ALL `)
    const offset = (query.page - 1) * query.pageSize
    const orderBy = buildClaimListOrderBy(query)

    // Count + page run concurrently — same scan cost, half the latency.
    const [countResult, listResult] = await Promise.all([
      this.db.execute<{ total: number | string }>(sql`
        SELECT count(*)::int AS total
        FROM (${unionSql}) AS unified
      `),
      this.db.execute<UnifiedListRow>(sql`
        SELECT *
        FROM (${unionSql}) AS unified
        ORDER BY ${orderBy}
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `),
    ])

    const total = toInt(countResult.rows[0]?.total ?? 0)

    return {
      items: listResult.rows.map(mapUnifiedRow),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  private async buildUnionBranches(query: ClaimListQuery, scope: ClaimsListScope): Promise<SQL[]> {
    const branches: SQL[] = []

    if (scope.includeEmotive && (query.kind === undefined || query.kind === ClaimKind.Emotive)) {
      const viewerUserId = scope.emotiveCustomerScope === 'own_customer' ? scope.userId : null
      if (scope.emotiveCustomerScope === 'own_customer') {
        const customerIds = await this.getUserCustomerIds(scope.userId)
        if (customerIds.length > 0) {
          branches.push(this.buildEmotiveBranch(query, customerIds, viewerUserId))
        }
      } else {
        branches.push(this.buildEmotiveBranch(query, null, viewerUserId))
      }
    }

    if (scope.includeDomace && (query.kind === undefined || query.kind === ClaimKind.Domace)) {
      branches.push(this.buildDomaceBranch(query))
    }

    return branches
  }

  private buildEmotiveBranch(
    query: ClaimListQuery,
    customerIds: string[] | null,
    viewerUserId: string | null,
  ): SQL {
    const conditions: SQL[] = []

    if (!query.includeDeleted) {
      conditions.push(sql`ec.deleted_at IS NULL`)
    }

    if (query.outcome !== undefined) {
      conditions.push(sql`ec.outcome = ${query.outcome}`)
    }

    if (query.sourceId !== undefined) {
      conditions.push(sql`ec.source_id = ${query.sourceId}`)
    }

    if (query.customerId !== undefined) {
      conditions.push(sql`ec.customer_id = ${query.customerId}`)
    }

    if (query.manufacturerId !== undefined) {
      conditions.push(sql`ec.manufacturer_id = ${query.manufacturerId}`)
    }

    if (query.categoryCode !== undefined) {
      // Semi-join on the code, not the id (spec §4.2): the code is what travels in the URL,
      // and a code no category carries yields an empty list rather than an error.
      conditions.push(sql`ec.category_id IN (
        SELECT id FROM claim_categories WHERE code = ${query.categoryCode} AND deleted_at IS NULL
      )`)
    }

    if (query.dateFrom !== undefined) {
      conditions.push(sql`ec.date_of_claim >= ${query.dateFrom.toISOString().slice(0, 10)}`)
    }

    if (query.dateTo !== undefined) {
      conditions.push(sql`ec.date_of_claim <= ${query.dateTo.toISOString().slice(0, 10)}`)
    }

    if (query.search !== undefined) {
      // Local columns (warranty + mr + claim number) via the
      // idx_emotive_claims_search_fts GIN expression (must match textually);
      // cross-table columns (customer / engine type / employee) via indexed
      // semi-joins — a cross-table tsvector could never use an index.
      const searchQuery = searchPrefixTsQuery(query.search)
      conditions.push(
        sql`(to_tsvector('simple', coalesce(ec.warranty_report, '') || ' ' || ec.mr_number || ' ' || coalesce(ec.claim_number, '')) @@ ${searchQuery}
          OR ec.customer_id IN (SELECT id FROM customers WHERE to_tsvector('simple', name) @@ ${searchQuery})
          OR ec.engine_type_id IN (SELECT id FROM engine_types WHERE to_tsvector('simple', code) @@ ${searchQuery})
          OR ec.employee_id IN (SELECT id FROM employees WHERE to_tsvector('simple', full_name) @@ ${searchQuery}))`,
      )
    }

    if (customerIds !== null) {
      conditions.push(
        sql`ec.customer_id IN (${sql.join(
          customerIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      // Own-customer viewers (portal clients) never see archived claims —
      // archiving is an internal housekeeping state, not a client outcome.
      conditions.push(sql`ec.outcome <> ${ClaimOutcome.Archived}`)
    }

    const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`TRUE`

    // Per-client-user NEW/UPDATE signal (Phase 3): only computed when there is
    // a single viewer (own-customer client scope) — a full-view/internal read
    // has no one "viewer", so it stays NULL and skips the join entirely.
    const freshnessColumn =
      viewerUserId === null
        ? sql`NULL::text AS freshness`
        : sql`
      CASE
        WHEN ec.client_visible_at IS NULL AND ec.published_at IS NULL THEN NULL
        WHEN ec.client_content_updated_at IS NULL THEN NULL
        WHEN v.viewed_at IS NOT NULL AND ec.client_content_updated_at <= v.viewed_at THEN NULL
        WHEN ec.published_at IS NULL THEN ${ClaimFreshness.New}
        ELSE ${ClaimFreshness.Update}
      END AS freshness`
    const viewerJoin =
      viewerUserId === null
        ? sql``
        : sql`LEFT JOIN emotive_claim_client_views v ON v.emotive_claim_id = ec.id AND v.user_id = ${viewerUserId}`

    return sql`
      SELECT
        ${ClaimKind.Emotive}::text AS kind,
        ec.id,
        ec.sequence_number,
        ec.claim_number,
        c.name AS customer_name,
        ec.warranty_report,
        ec.engine_type_id,
        et.code AS engine_type_code,
        ec.manufacturer_id,
        em.name AS manufacturer_name,
        ec.category_id,
        cc.code AS category_code,
        cc.name AS category_name,
        ec.engine_code,
        ec.date_of_claim,
        ec.mr_number,
        ec.date_of_finish,
        ec.employee_id,
        emp.full_name AS employee_name,
        ec.source_id,
        ec.customer_id,
        ec.outcome,
        ec.claim_year,
        NULL::numeric AS total_amount,
        ec.created_at,
        ec.client_visible_at,
        ec.published_at,
        ${freshnessColumn}
      FROM emotive_claims ec
      INNER JOIN engine_types et ON et.id = ec.engine_type_id
      LEFT JOIN engine_manufacturers em ON em.id = ec.manufacturer_id
      LEFT JOIN claim_categories cc ON cc.id = ec.category_id
      LEFT JOIN customers c ON c.id = ec.customer_id
      LEFT JOIN employees emp ON emp.id = ec.employee_id
      ${viewerJoin}
      WHERE ${whereClause}
    `
  }

  private buildDomaceBranch(query: ClaimListQuery): SQL {
    const conditions: SQL[] = []

    if (!query.includeDeleted) {
      conditions.push(sql`dc.deleted_at IS NULL`)
    }

    if (query.outcome !== undefined) {
      conditions.push(sql`dc.outcome = ${query.outcome}`)
    }

    if (query.manufacturerId !== undefined) {
      conditions.push(sql`dc.manufacturer_id = ${query.manufacturerId}`)
    }

    if (query.categoryCode !== undefined) {
      // The DOMAĆE half of the same filter. Both branches or neither — a filter written into
      // one branch of a UNION silently returns the whole other family.
      conditions.push(sql`dc.category_id IN (
        SELECT id FROM claim_categories WHERE code = ${query.categoryCode} AND deleted_at IS NULL
      )`)
    }

    if (query.dateFrom !== undefined) {
      conditions.push(sql`dc.date_of_claim >= ${query.dateFrom.toISOString().slice(0, 10)}`)
    }

    if (query.dateTo !== undefined) {
      conditions.push(sql`dc.date_of_claim <= ${query.dateTo.toISOString().slice(0, 10)}`)
    }

    if (query.search !== undefined) {
      // Local columns (warranty + mr + customer + claim number) via the
      // idx_domace_claims_search_fts GIN expression (textually identical);
      // engine type / employee via indexed semi-joins.
      const searchQuery = searchPrefixTsQuery(query.search)
      conditions.push(
        sql`(to_tsvector('simple', coalesce(dc.warranty_report, '') || ' ' || coalesce(dc.mr_number, '') || ' ' || coalesce(dc.customer_name, '') || ' ' || coalesce(dc.claim_number, '')) @@ ${searchQuery}
          OR dc.engine_type_id IN (SELECT id FROM engine_types WHERE to_tsvector('simple', code) @@ ${searchQuery})
          OR dc.employee_id IN (SELECT id FROM employees WHERE to_tsvector('simple', full_name) @@ ${searchQuery}))`,
      )
    }

    if (query.sourceId !== undefined || query.customerId !== undefined) {
      // DOMACE has no source/customer FK filters — force empty branch when set.
      conditions.push(sql`FALSE`)
    }

    const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`TRUE`

    return sql`
      SELECT
        ${ClaimKind.Domace}::text AS kind,
        dc.id,
        dc.sequence_number,
        dc.claim_number,
        dc.customer_name,
        dc.warranty_report,
        dc.engine_type_id,
        et.code AS engine_type_code,
        dc.manufacturer_id,
        em.name AS manufacturer_name,
        dc.category_id,
        cc.code AS category_code,
        cc.name AS category_name,
        dc.engine_code,
        dc.date_of_claim,
        dc.mr_number,
        dc.date_of_finish,
        dc.employee_id,
        emp.full_name AS employee_name,
        NULL::uuid AS source_id,
        NULL::uuid AS customer_id,
        dc.outcome,
        dc.claim_year,
        dc.total_amount,
        dc.created_at,
        NULL::timestamptz AS client_visible_at,
        NULL::timestamptz AS published_at,
        NULL::text AS freshness
      FROM domace_claims dc
      LEFT JOIN engine_types et ON et.id = dc.engine_type_id
      LEFT JOIN engine_manufacturers em ON em.id = dc.manufacturer_id
      LEFT JOIN claim_categories cc ON cc.id = dc.category_id
      LEFT JOIN employees emp ON emp.id = dc.employee_id
      WHERE ${whereClause}
    `
  }
}
