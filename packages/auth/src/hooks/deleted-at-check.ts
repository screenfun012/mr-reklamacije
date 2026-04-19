import { schema } from '@mr/db'
import { APIError } from 'better-auth/api'
import type { Session } from 'better-auth'
import { and, eq, isNotNull } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

/**
 * Database hook: prevent sessions being created for soft-deleted users.
 *
 * Runs in databaseHooks.session.create.before — before BA writes the
 * sessions row. If users.deleted_at is set, throws APIError and the
 * session write is aborted.
 *
 * Layered with is_active (Better-Auth standard check via additionalFields):
 * - is_active=false: normal deactivation, BA handles
 * - deleted_at!=NULL: GDPR/audit hard-delete with row retained, this
 *   hook blocks
 */
export function createDeletedAtCheckHook(db: NodePgDatabase<typeof schema>) {
  return async (session: Session & Record<string, unknown>) => {
    const deletedUser = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, session.userId), isNotNull(schema.users.deletedAt)))
      .limit(1)

    if (deletedUser.length > 0) {
      throw new APIError('UNAUTHORIZED', {
        message: 'Account has been deleted',
      })
    }
  }
}
