import { and, eq, sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import {
  buildPaginatedSlice,
  parseOptionalKeysetCursor,
  type KeysetCursor,
} from '../../core/utils/pagination.js'
import { auditLog, users } from './audit-log.schema.js'
import type {
  AuditLogListItem,
  AuditLogListQuery,
  ReferenceListResponse,
} from './audit-log.validators.js'

/**
 * Exact created_at value as Postgres text (microsecond precision). Used as the
 * keyset cursor so pagination never skips rows that share a millisecond — the
 * JS `Date` millisecond truncation behind `keysetBefore`/`getTime()` cannot.
 */
const createdAtCursorSql = sql<string>`${auditLog.createdAt}::text`

/** Keyset condition for ORDER BY created_at DESC, id DESC at full timestamp precision. */
function keysetBeforeAudit(cursor: KeysetCursor | null): SQL | undefined {
  if (cursor === null) {
    return undefined
  }

  const primary = String(cursor.primary)
  return sql`(${auditLog.createdAt} < ${primary}::timestamptz OR (${auditLog.createdAt} = ${primary}::timestamptz AND ${auditLog.id} < ${cursor.id}))`
}

interface AuditLogRow {
  id: string
  createdAt: Date
  createdAtText: string
  action: AuditLogListItem['action']
  entityType: string
  entityId: string
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  actorIp: string | null
  actorUserAgent: string | null
  changes: unknown
  context: unknown
}

function mapAuditLogRow(row: AuditLogRow): AuditLogListItem {
  const actor =
    row.actorUserId !== null && row.actorName !== null && row.actorEmail !== null
      ? { id: row.actorUserId, name: row.actorName, email: row.actorEmail }
      : null

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actor,
    actorIp: row.actorIp,
    actorUserAgent: row.actorUserAgent,
    changes: row.changes ?? null,
    context: row.context ?? null,
  }
}

export class AuditLogRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: AuditLogListQuery): Promise<ReferenceListResponse<AuditLogListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = []

    if (query.actorUserId !== undefined) {
      conditions.push(eq(auditLog.actorUserId, query.actorUserId))
    }
    if (query.entityType !== undefined) {
      conditions.push(eq(auditLog.entityType, query.entityType))
    }
    if (query.entityId !== undefined) {
      conditions.push(eq(auditLog.entityId, query.entityId))
    }
    if (query.action !== undefined) {
      conditions.push(eq(auditLog.action, query.action))
    }
    if (query.dateFrom !== undefined) {
      conditions.push(sql`${auditLog.createdAt} >= ${query.dateFrom}::date`)
    }
    if (query.dateTo !== undefined) {
      conditions.push(sql`${auditLog.createdAt} < (${query.dateTo}::date + interval '1 day')`)
    }

    const keysetCondition = keysetBeforeAudit(cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        createdAtText: createdAtCursorSql,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        actorUserId: auditLog.actorUserId,
        actorName: users.name,
        actorEmail: users.email,
        actorIp: auditLog.actorIp,
        actorUserAgent: auditLog.actorUserAgent,
        changes: auditLog.changes,
        context: auditLog.context,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      /*
       * ⚠ `NULLS LAST` spelled out, and it is not decoration.
       *
       * The index is `(created_at DESC NULLS LAST, id DESC NULLS LAST)` — that is what drizzle
       * emits — while a plain `DESC` in Postgres means NULLS FIRST. The two do not match, so the
       * planner ignores the index and sorts the whole table: measured on the dev database, a Seq
       * Scan + Sort where the same query with NULLS LAST is an Index Only Scan.
       *
       * Both columns are NOT NULL, so the two spellings mean exactly the same thing here. This is
       * a pure planner miss, and it grows with the table — the audit log is the one table that only
       * ever gets bigger.
       */
      .orderBy(sql`${auditLog.createdAt} DESC NULLS LAST`, sql`${auditLog.id} DESC NULLS LAST`)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.createdAtText,
      id: row.id,
    }))

    return {
      items: page.items.map(mapAuditLogRow),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }
}
