import { ERROR_CODE, type Permission } from '@mr/shared'
import type { MiddlewareHandler } from 'hono'

import { AppError } from '../errors/app-error.js'

/**
 * Requires the user to have at least ONE of the given permissions (ANY).
 * Throws 401 if not authenticated; 403 if none match.
 *
 * Reads `user.permissions` from the Better-Auth customSession payload (no DB roundtrip).
 */
export function requirePermissions(...allowedPermissions: Permission[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) {
      throw new AppError(ERROR_CODE.Unauthorized, 401, 'Authentication required')
    }

    const userPermissions = user.permissions ?? []
    const hasRequiredPermission = allowedPermissions.some((p) => userPermissions.includes(p))

    if (!hasRequiredPermission) {
      const isDev = process.env['NODE_ENV'] !== 'production'
      const message = isDev
        ? `Required one of: ${allowedPermissions.join(', ')}. User has: ${userPermissions.length} permissions`
        : 'Insufficient permissions'

      throw new AppError(ERROR_CODE.Forbidden, 403, message)
    }

    await next()
  }
}
