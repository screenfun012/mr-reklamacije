import type { PermissionResolver } from '@mr/auth'
import { ERROR_CODE, type Permission } from '@mr/shared'
import type { MiddlewareHandler } from 'hono'

import { AppError } from '../errors/app-error.js'

/**
 * Per-route middleware. Requires authenticated user with the given
 * permission. Throws 401 if no user, 403 if user lacks permission.
 *
 * Assumes sessionMiddleware ran first (populated c.var.user).
 */
export function requirePermission(
  permission: Permission,
  resolver: PermissionResolver,
): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) {
      throw new AppError(ERROR_CODE.Unauthorized, 401, 'Authentication required')
    }
    const allowed = await resolver.hasPermission(user.id, permission)
    if (!allowed) {
      throw new AppError(ERROR_CODE.Forbidden, 403, `Missing permission: ${permission}`)
    }
    await next()
  }
}
