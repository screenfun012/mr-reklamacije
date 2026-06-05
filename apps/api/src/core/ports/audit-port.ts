import type { AuditAction } from '@mr/shared'

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

export interface AuditPort {
  log(entry: AuditEntry): Promise<void>
}
