import { ERROR_CODE } from '@mr/shared'
import type { Context, MiddlewareHandler } from 'hono'

import { AppError } from '../errors/app-error.js'

interface RateLimitOptions {
  windowMs: number
  max: number
  keyOf?: (c: Context) => string
}

interface Bucket {
  count: number
  resetAt: number
}

/**
 * In-memory fixed-window rate limiter. Suitable for Phase 0
 * (single-instance API). Replace with Redis/unstorage when
 * scaling horizontally in Phase 2+.
 */
export function createRateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const buckets = new Map<string, Bucket>()

  const defaultKey = (c: Context): string => {
    const forwarded = c.req.header('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0]!.trim()
    }
    const realIp = c.req.header('x-real-ip')
    if (realIp) {
      return realIp
    }
    return 'unknown'
  }

  const keyOf = options.keyOf ?? defaultKey

  const cleanupIntervalMs = Math.max(options.windowMs, 60_000)
  setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key)
      }
    }
  }, cleanupIntervalMs).unref()

  return async (c, next) => {
    const key = keyOf(c)
    const now = Date.now()
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
      await next()
      return
    }

    bucket.count++
    if (bucket.count > options.max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000)
      c.header('Retry-After', String(retryAfterSec))
      throw new AppError(
        ERROR_CODE.RateLimited,
        429,
        `Too many requests. Retry after ${retryAfterSec}s.`,
      )
    }

    await next()
  }
}

export const generalRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 100,
})

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 5,
})
