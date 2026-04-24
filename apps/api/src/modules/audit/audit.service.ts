import { schema } from '@mr/db'
import type { AuditAction } from '@mr/shared'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export interface AuditEntry {
  entityType: string
  entityId: string
  action: AuditAction
  actorUserId?: string | null
  actorIp?: string | null
  actorUserAgent?: string | null
  changes?: Record<string, unknown> | null
  context?: Record<string, unknown> | null
}

/**
 * AuditService — writes audit_log rows for business mutations.
 *
 * Usage patterns:
 * - From route handler: pass actor context extracted from Hono c.
 * - From Better-Auth hook: used for login audit (no Hono c available).
 * - From background job: actorUserId = null (system action).
 *
 * This is a write-only API in Phase 0. Query/export operations come in
 * Phase 3 (admin audit log UI).
 */
export class AuditService {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.db.insert(schema.auditLog).values({
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorUserId: entry.actorUserId ?? null,
      actorIp: entry.actorIp ?? null,
      actorUserAgent: entry.actorUserAgent ?? null,
      changes: entry.changes ?? null,
      context: entry.context ?? null,
    })
  }
}
