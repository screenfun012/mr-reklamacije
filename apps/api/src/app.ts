import type { Logger } from '@mr/logger'
import { Hono } from 'hono'

import type { Env } from './config/env.js'
import { registerHealthRoutes } from './routes/health.js'

export interface AppDeps {
  logger: Logger
  env: Env
}

/**
 * Hono app factory. Does NOT call serve() — that's in server.ts.
 * Tests instantiate this with mock env and logger.
 */
export function createApp(deps: AppDeps): Hono {
  void deps
  const app = new Hono()

  registerHealthRoutes(app)

  return app
}
