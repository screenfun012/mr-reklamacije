import { createServerSessionLoader, requireRoles } from '@mr/auth/route-guards'

import { authClient } from './auth-client'

const apiOrigin = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000'
export const loadServerSession = createServerSessionLoader(apiOrigin)

export function portalRequireRoles(allowedRoles: readonly string[]) {
  return requireRoles(authClient, allowedRoles, loadServerSession)
}
