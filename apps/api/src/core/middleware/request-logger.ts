import type { Logger } from '@mr/logger'
import type { MiddlewareHandler } from 'hono'

// Railway probes /health continuously — logging each probe is pure noise.
const SKIPPED_PATHS = new Set(['/health', '/api/health'])

/**
 * Above this, a request is worth finding in the log rather than scrolling past.
 * The app targets p95 under 200 ms, so a second is already an outlier — logging it
 * at `warn` is what turns "a screen feels slow sometimes" into something greppable
 * without an APM vendor (docs/22 §3).
 */
const SLOW_REQUEST_MS = 1_000

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
    const fields = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
    }

    if (durationMs >= SLOW_REQUEST_MS) {
      logger.warn(fields, 'slow request')
      return
    }

    logger.info(fields, 'request')
  }
}
