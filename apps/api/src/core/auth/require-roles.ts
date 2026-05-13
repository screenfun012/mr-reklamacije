import { ERROR_CODE } from '@mr/shared'
import type { MiddlewareHandler } from 'hono'

import { AppError } from '../errors/app-error.js'

/**
 * Requires the user to have at least ONE of the given roles (ANY).
 * Throws 401 if not authenticated; 403 if none match.
 *
 * Reads `user.roles` from the Better-Auth customSession payload (no DB roundtrip).
 */
export function requireRoles(...allowedRoles: string[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) {
      throw new AppError(ERROR_CODE.Unauthorized, 401, 'Authentication required')
    }

    const userRoles = user.roles ?? []
    const hasRequiredRole = allowedRoles.some((r) => userRoles.includes(r))

    if (!hasRequiredRole) {
      const isDev = process.env['NODE_ENV'] !== 'production'
      const message = isDev
        ? `Required roles: ${allowedRoles.join(', ')}. User roles: ${userRoles.join(', ') || 'none'}`
        : 'Insufficient role'

      throw new AppError(ERROR_CODE.Forbidden, 403, message)
    }

    await next()
  }
}
