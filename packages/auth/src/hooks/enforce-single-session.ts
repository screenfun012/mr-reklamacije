import { schema } from '@mr/db'
import type { Session } from 'better-auth'
import { and, eq, ne } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

/**
 * Database hook: enforce a single active session per user (strict
 * single-device policy).
 *
 * Runs in databaseHooks.session.create.after — after Better-Auth has written
 * the new session row. Deletes every OTHER session for the same user, so a
 * fresh login on any device signs out all previously logged-in devices.
 *
 * The just-created session is excluded by id and MUST survive: deleting it
 * would log the user out on every login and could lock out the protected
 * admin. The single-session.integration test asserts the new session lives.
 *
 * Best-effort: a revoke failure is logged, never re-thrown — it must not
 * block a valid login. No structured logger in BA hook scope (matches
 * login-audit).
 */
export function createEnforceSingleSessionHook(db: NodePgDatabase<typeof schema>) {
  return async (session: Session & Record<string, unknown>): Promise<void> => {
    try {
      await db
        .delete(schema.sessions)
        .where(and(eq(schema.sessions.userId, session.userId), ne(schema.sessions.id, session.id)))
    } catch (error) {
      console.error('[single-session] Failed to revoke other sessions:', error)
    }
  }
}
