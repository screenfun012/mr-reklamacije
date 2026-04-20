import type { Logger } from '@mr/logger'
import { Hono } from 'hono'

import type { Env } from './config/env.js'
import { registerGlobalErrorHandler } from './core/middleware/error-handler.js'
import { generalRateLimiter } from './core/middleware/rate-limit.js'
import { createRequestLogger } from './core/middleware/request-logger.js'
import { registerHealthRoutes } from './routes/health.js'

export interface AppDeps {
  logger: Logger
  env: Env
}

/**
 * Hono app factory. Middleware order (outer to inner):
 * 1. Request logger — capture duration of whole pipeline
 * 2. Rate limiter — reject excessive traffic early
 * 3. Routes
 * Error handling via app.onError() (not middleware).
 */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  registerGlobalErrorHandler(app, deps.logger)
  app.use('*', createRequestLogger(deps.logger))
  app.use('*', generalRateLimiter)

  registerHealthRoutes(app)

  void deps.env

  return app
}
