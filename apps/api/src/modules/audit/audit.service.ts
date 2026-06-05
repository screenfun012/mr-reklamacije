import { schema } from '@mr/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { AuditEntry, AuditPort } from '../../core/ports/audit-port.js'

export type { AuditEntry } from '../../core/ports/audit-port.js'

/**
 * AuditService — writes audit_log rows for business mutations.
 */
export class AuditService implements AuditPort {
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
