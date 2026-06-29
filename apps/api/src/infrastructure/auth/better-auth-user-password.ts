import { setUserPassword, type Auth } from '@mr/auth'

import type { UserPasswordPort } from '../../core/ports/user-password-port.js'

export function createBetterAuthUserPassword(auth: Auth): UserPasswordPort {
  return {
    setPassword: (userId, newPassword) => setUserPassword(auth, userId, newPassword),
  }
}
