import { schema } from '@mr/db'
import type { Session } from 'better-auth'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { createEnforceSingleSessionHook } from './enforce-single-session.js'
import { createLoginAuditHook } from './login-audit.js'

/**
 * Runs all session.create.after steps in order: audit the login, then enforce
 * the single-device policy (revoke the user's other sessions). Mirrors the
 * session.create.before guard chain.
 */
export function createSessionCreateAfterHook(db: NodePgDatabase<typeof schema>) {
  const loginAudit = createLoginAuditHook(db)
  const enforceSingleSession = createEnforceSingleSessionHook(db)

  return async (session: Session & Record<string, unknown>): Promise<void> => {
    await loginAudit(session)
    await enforceSingleSession(session)
  }
}
