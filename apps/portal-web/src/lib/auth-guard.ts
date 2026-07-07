import { createServerSessionLoader, requireRoles } from '@mr/auth/route-guards'

import { authClient } from './auth-client'

export const loadServerSession = createServerSessionLoader()

export function portalRequireRoles(allowedRoles: readonly string[]) {
  return requireRoles(authClient, allowedRoles, loadServerSession)
}
