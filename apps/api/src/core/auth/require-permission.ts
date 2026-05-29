import type { Permission } from '@mr/shared'
import type { MiddlewareHandler } from 'hono'

import { requirePermissions } from './require-permissions.js'

/** Requires a single permission. Alias for `requirePermissions(permission)`. */
export function requirePermission(permission: Permission): MiddlewareHandler {
  return requirePermissions(permission)
}
