import type { Auth } from '@mr/auth'
import type { MiddlewareHandler } from 'hono'

import type { MRSessionUser } from './session-types.js'

/**
 * Populates Hono context with session and user (or null).
 * Unauthenticated API access is enforced by global `requireAuth` in `app.ts`;
 * fine-grained checks use `requirePermissions` / `requireRoles` per route.
 */
export function createSessionMiddleware(auth: Auth): MiddlewareHandler {
  return async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })
    if (session) {
      c.set('session', session.session)
      // customSession always adds roles + permissions; BA's generic user type does not list them.
      c.set('user', session.user as MRSessionUser)
    } else {
      c.set('session', null)
      c.set('user', null)
    }
    await next()
  }
}
