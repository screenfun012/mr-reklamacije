import { schema } from '@mr/db'
import { UserAccountStatus } from '@mr/shared'
import { APIError } from 'better-auth/api'
import type { Session } from 'better-auth'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { AUTH_ERROR_ACCOUNT_PENDING, AUTH_ERROR_ACCOUNT_REJECTED } from '../auth-error-codes.js'

/**
 * Database hook: block session creation for users who are not approved.
 *
 * Runs in databaseHooks.session.create.before — after credentials verify,
 * before the sessions row is written. Pending/rejected users never receive
 * a session cookie.
 */
export function createAccountStatusCheckHook(db: NodePgDatabase<typeof schema>) {
  return async (session: Session & Record<string, unknown>) => {
    const rows = await db
      .select({ accountStatus: schema.users.accountStatus })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1)

    const status = rows[0]?.accountStatus

    if (status === UserAccountStatus.Approved) {
      return
    }

    if (status === UserAccountStatus.Rejected) {
      throw new APIError('UNAUTHORIZED', {
        message: AUTH_ERROR_ACCOUNT_REJECTED,
      })
    }

    throw new APIError('UNAUTHORIZED', {
      message: AUTH_ERROR_ACCOUNT_PENDING,
    })
  }
}
