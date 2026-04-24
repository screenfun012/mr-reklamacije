import type { Auth } from '@mr/auth'
import type { MiddlewareHandler } from 'hono'

/**
 * Populates Hono context with session and user (or null).
 * Does not reject unauthenticated requests — that's requirePermission's job.
 */
export function createSessionMiddleware(auth: Auth): MiddlewareHandler {
  return async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })
    if (session) {
      c.set('session', session.session)
      c.set('user', session.user)
    } else {
      c.set('session', null)
      c.set('user', null)
    }
    await next()
  }
}
