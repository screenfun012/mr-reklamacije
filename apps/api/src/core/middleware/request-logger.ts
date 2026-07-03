import type { Logger } from '@mr/logger'
import type { MiddlewareHandler } from 'hono'

// Railway probes /health continuously — logging each probe is pure noise.
const SKIPPED_PATHS = new Set(['/health', '/api/health'])

/**
 * Logs method, path, status, duration for every request.
 * No PII — only HTTP metadata.
 */
export function createRequestLogger(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    if (SKIPPED_PATHS.has(c.req.path)) {
      return next()
    }

    const start = performance.now()
    await next()
    const durationMs = Math.round(performance.now() - start)
    logger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
      },
      'request',
    )
  }
}
