import type { Auth, PermissionResolver } from '@mr/auth'
import type { Logger } from '@mr/logger'
import { Hono } from 'hono'

import type { Env } from './config/env.js'
import { requireAuth } from './core/auth/require-auth.js'
import { createSessionMiddleware } from './core/auth/session-middleware.js'
import type { BetterAuthFullSession, MRSessionUser } from './core/auth/session-types.js'
import { registerGlobalErrorHandler } from './core/middleware/error-handler.js'
import { generalRateLimiter, loginRateLimiter } from './core/middleware/rate-limit.js'
import { createRequestLogger } from './core/middleware/request-logger.js'
import type { AuditService } from './modules/audit/index.js'
import { registerHealthRoutes } from './routes/health.js'

export interface AppDeps {
  logger: Logger
  env: Env
  auth: Auth
  permissionResolver: PermissionResolver
  auditService: AuditService
}

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
 * 5. Session middleware (sets user / session vars)
 * 6. Global requireAuth with opt-out for public prefixes (auth + health)
 * 7. Better-Auth `/api/auth/*`
 * 8. Routes (health, future modules)
 */
export function createApp(deps: AppDeps): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()

  registerGlobalErrorHandler(app, deps.logger)
  app.use('*', createRequestLogger(deps.logger))
  app.use('*', generalRateLimiter)
  app.use('/api/auth/sign-in/email', loginRateLimiter)
  app.use('*', createSessionMiddleware(deps.auth))

  app.use('*', async (c, next) => {
    if (isPublicPath(c.req.path)) {
      return next()
    }
    return requireAuth()(c, next)
  })

  app.on(['POST', 'GET'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw))

  registerHealthRoutes(app)

  void deps.env
  void deps.permissionResolver
  void deps.auditService

  return app
}
