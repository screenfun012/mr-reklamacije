import { ERROR_CODE } from '@mr/shared'
import type { MiddlewareHandler } from 'hono'

import { AppError } from '../errors/app-error.js'

/**
 * Requires authenticated user. Throws 401 if `c.var.user` is null.
 * Assumes session middleware ran first.
 */
export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) {
      throw new AppError(ERROR_CODE.Unauthorized, 401, 'Authentication required')
    }
    await next()
  }
}
