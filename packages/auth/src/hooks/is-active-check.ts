import { schema } from '@mr/db'
import { APIError } from 'better-auth/api'
import type { Session } from 'better-auth'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { AUTH_ERROR_ACCOUNT_DEACTIVATED } from '../auth-error-codes.js'

/**
 * Database hook: block session creation for deactivated users (is_active = false).
 *
 * Runs in databaseHooks.session.create.before — after credentials verify, before
 * the sessions row is written. `is_active` is a Better-Auth additionalField that
 * the library stores but never gates sign-in on, so without this hook a
 * deactivated user could still log back in; this is the gate that gives it teeth.
 */
export function createIsActiveCheckHook(db: NodePgDatabase<typeof schema>) {
  return async (session: Session & Record<string, unknown>) => {
    const rows = await db
      .select({ isActive: schema.users.isActive })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1)

    if (rows[0]?.isActive === false) {
      throw new APIError('UNAUTHORIZED', {
        message: AUTH_ERROR_ACCOUNT_DEACTIVATED,
      })
    }
  }
}
