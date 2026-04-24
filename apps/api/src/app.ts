import type { Auth, PermissionResolver } from '@mr/auth'
import type { Logger } from '@mr/logger'
import { Hono } from 'hono'

import type { Env } from './config/env.js'
import { createSessionMiddleware } from './core/auth/session-middleware.js'
import { registerGlobalErrorHandler } from './core/middleware/error-handler.js'
import {
  generalRateLimiter,
  loginRateLimiter,
} from './core/middleware/rate-limit.js'
import { createRequestLogger } from './core/middleware/request-logger.js'
import { registerHealthRoutes } from './routes/health.js'

export interface AppDeps {
  logger: Logger
  env: Env
  auth: Auth
  permissionResolver: PermissionResolver
}

type SessionPayload = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>

export type AppVariables = {
  user: SessionPayload['user'] | null
  session: SessionPayload['session'] | null
}

/**
 * Hono app factory. Middleware order (outer to inner):
 * 1. registerGlobalErrorHandler (app.onError)
 * 2. Request logger
 * 3. General rate limiter
 * 4. Login rate limiter (sign-in email only)
 * 5. Session middleware
 * 6. Better-Auth /api/auth/*
 * 7. Routes (e.g. health)
 */
export function createApp(deps: AppDeps): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()

  registerGlobalErrorHandler(app, deps.logger)
  app.use('*', createRequestLogger(deps.logger))
  app.use('*', generalRateLimiter)
  app.use('/api/auth/sign-in/email', loginRateLimiter)
  app.use('*', createSessionMiddleware(deps.auth))

  app.on(['POST', 'GET'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw))

  registerHealthRoutes(app)

  void deps.env
  void deps.permissionResolver

  return app
}
