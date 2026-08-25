import { schema } from '@mr/db'
import { MAX_ACTIVE_SESSIONS_PER_USER } from '@mr/shared'
import type { Session } from 'better-auth'
import { and, desc, eq, ne, notInArray, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

/**
 * How many browser sessions one account may keep active.
 *
 * A session is scoped to one host and browser context, so this is intentionally not a physical-device
 * count. Five covers the normal phone/tablet/desktop use alongside the separate admin and internal
 * hosts, while still bounding a stolen password to a small number of live sessions.
 */
/**
 * Database hook: keep at most `MAX_ACTIVE_SESSIONS_PER_USER` sessions per account.
 *
 * Runs in databaseHooks.session.create.after — after Better-Auth has written the new session row.
 * What goes is the least recently renewed session, not the oldest login: `updated_at` moves when a
 * session is refreshed, so an active office computer is not signed out just because a phone logged
 * in after it.
 *
 * ⚠ The just-created session is excluded from the ranking and deletion. It always survives, while
 * exactly four older sessions are kept beside it; clock skew or equal timestamps therefore cannot
 * turn the five-session ceiling into six.
 *
 * Best-effort: a failure is logged, never re-thrown — it must not block a valid login. No
 * structured logger in BA hook scope (matches login-audit).
 */
export function createEnforceSessionLimitHook(db: NodePgDatabase<typeof schema>) {
  return async (session: Session & Record<string, unknown>): Promise<void> => {
    try {
      await db.transaction(async (tx) => {
        // Serialise simultaneous logins for this person on every API replica. Without the parent
        // row lock, two hooks can rank the same pre-login set while both new sessions survive.
        await tx.execute(
          sql`SELECT ${schema.users.id} FROM ${schema.users}
              WHERE ${schema.users.id} = ${session.userId}
              FOR UPDATE`,
        )

        const keepOlder = tx
          .select({ id: schema.sessions.id })
          .from(schema.sessions)
          .where(
            and(eq(schema.sessions.userId, session.userId), ne(schema.sessions.id, session.id)),
          )
          .orderBy(
            desc(schema.sessions.updatedAt),
            desc(schema.sessions.createdAt),
            desc(schema.sessions.id),
          )
          .limit(MAX_ACTIVE_SESSIONS_PER_USER - 1)

        await tx
          .delete(schema.sessions)
          .where(
            and(
              eq(schema.sessions.userId, session.userId),
              ne(schema.sessions.id, session.id),
              notInArray(schema.sessions.id, keepOlder),
            ),
          )
      })
    } catch (error) {
      console.error('[session-limit] Failed to revoke the oldest sessions:', error)
    }
  }
}
