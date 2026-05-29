import { Hono } from 'hono'

import type { Container } from './core/container.js'
import { requireAuth } from './core/auth/require-auth.js'
import { createSessionMiddleware } from './core/auth/session-middleware.js'
import type { BetterAuthFullSession, MRSessionUser } from './core/auth/session-types.js'
import { registerGlobalErrorHandler } from './core/middleware/error-handler.js'
import { generalRateLimiter, loginRateLimiter } from './core/middleware/rate-limit.js'
import { createRequestLogger } from './core/middleware/request-logger.js'
import { registerHealthRoutes } from './routes/health.js'

export type { MRSessionUser }

export type AppVariables = {
  user: MRSessionUser | null
  session: BetterAuthFullSession['session'] | null
}

function isPublicPath(path: string): boolean {
  if (path.startsWith('/api/auth')) {
    return true
  }
  if (path === '/health' || path === '/api/health') {
    return true
  }
  return false
}

/**
 * Hono app factory. Middleware order (outer to inner):
 * 1. registerGlobalErrorHandler (app.onError)
 * 2. Request logger
 * 3. General rate limiter
 * 4. Login rate limiter (sign-in email only)
 * 5. Session middleware
 * 6. Global requireAuth with opt-out for public prefixes (auth + health)
 * 7. Better-Auth `/api/auth/*`
 * 8. Routes (health, future modules)
 */
export function createApp(container: Container): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()

  registerGlobalErrorHandler(app, container.logger)
  app.use('*', createRequestLogger(container.logger))
  app.use('*', generalRateLimiter)
  app.use('/api/auth/sign-in/email', loginRateLimiter)
  app.use('*', createSessionMiddleware(container.auth))

  app.use('*', async (c, next) => {
    if (isPublicPath(c.req.path)) {
      return next()
    }
    return requireAuth()(c, next)
  })

  app.on(['POST', 'GET'], '/api/auth/*', (c) => container.auth.handler(c.req.raw))

  registerHealthRoutes(app)

  void container.env
  void container.permissionResolver
  void container.auditService

  return app
}
