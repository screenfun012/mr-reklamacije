import type { Logger } from '@mr/logger'
import type { MiddlewareHandler } from 'hono'

/**
 * Logs method, path, status, duration for every request.
 * No PII — only HTTP metadata.
 */
export function createRequestLogger(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
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
