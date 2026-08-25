import { schema } from '@mr/db'
import type { Session } from 'better-auth'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { createEnforceSessionLimitHook } from './enforce-session-limit.js'
import { createLoginAuditHook } from './login-audit.js'

/**
 * Runs all session.create.after steps in order: audit the login, then enforce the session cap
 * (revoke sessions beyond it). Mirrors the session.create.before guard chain.
 */
export function createSessionCreateAfterHook(db: NodePgDatabase<typeof schema>) {
  const loginAudit = createLoginAuditHook(db)
  const enforceSessionLimit = createEnforceSessionLimitHook(db)

  return async (session: Session & Record<string, unknown>): Promise<void> => {
    await loginAudit(session)
    await enforceSessionLimit(session)
  }
}
