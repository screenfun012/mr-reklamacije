import { schema } from '@mr/db'
import { AuditAction } from '@mr/shared'
import type { Session } from 'better-auth'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

/**
 * Database hook: record audit_log entry for successful login.
 *
 * Runs in databaseHooks.session.create.after — after BA has
 * successfully written the session row (login succeeded). Does
 * NOT run on failed logins (BA doesn't write session in that
 * case).
 *
 * Best-effort: errors here are swallowed and logged, not
 * re-thrown. A failed audit write must NOT prevent a user from
 * logging in.
 */
export function createLoginAuditHook(db: NodePgDatabase<typeof schema>) {
  return async (session: Session & Record<string, unknown>) => {
    try {
      await db.insert(schema.auditLog).values({
        entityType: 'user',
        entityId: session.userId,
        action: AuditAction.Login,
        actorUserId: session.userId,
        actorIp: session.ipAddress ?? null,
        actorUserAgent: session.userAgent ?? null,
        context: {
          sessionId: session.id,
        },
      })
    } catch (error) {
      // Best-effort audit — never block login on audit write failure.
      // No structured logger in BA hook scope.
      console.error('[audit] Failed to log login event:', error)
    }
  }
}
