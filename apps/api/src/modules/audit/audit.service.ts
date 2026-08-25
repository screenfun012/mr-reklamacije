import { schema } from '@mr/db'

import type { ApiDatabase } from '../../core/database.js'
import type { AuditEntry, AuditPort } from '../../core/ports/audit-port.js'

export type { AuditEntry } from '../../core/ports/audit-port.js'

/**
 * AuditService — writes audit_log rows for business mutations.
 */
export class AuditService implements AuditPort {
  constructor(private readonly db: ApiDatabase) {}

  async log(entry: AuditEntry, executor: ApiDatabase = this.db): Promise<void> {
    await executor.insert(schema.auditLog).values({
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
