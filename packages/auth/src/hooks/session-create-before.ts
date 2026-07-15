import { schema } from '@mr/db'
import type { Session } from 'better-auth'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { createAccountStatusCheckHook } from './account-status-check.js'
import { createDeletedAtCheckHook } from './deleted-at-check.js'
import { createIsActiveCheckHook } from './is-active-check.js'

/** Runs all session.create.before guards in order (deleted → deactivated → account status). */
export function createSessionCreateBeforeHook(db: NodePgDatabase<typeof schema>) {
  const deletedAtCheck = createDeletedAtCheckHook(db)
  const isActiveCheck = createIsActiveCheckHook(db)
  const accountStatusCheck = createAccountStatusCheckHook(db)

  return async (session: Session & Record<string, unknown>) => {
    await deletedAtCheck(session)
    await isActiveCheck(session)
    await accountStatusCheck(session)
  }
}
