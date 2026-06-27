import { revokeUserSessions, type Auth } from '@mr/auth'

import type { UserSessionsPort } from '../../core/ports/user-sessions-port.js'

export function createBetterAuthUserSessions(auth: Auth): UserSessionsPort {
  return {
    revokeAllForUser: (userId) => revokeUserSessions(auth, userId),
  }
}
