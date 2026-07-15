import { ERROR_CODE } from '@mr/shared'
import type { Context, MiddlewareHandler } from 'hono'

import { AppError } from '../errors/app-error.js'
import { clientIpOf } from '../http/client-ip.js'

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

  const defaultKey = (c: Context): string => clientIpOf(c) ?? 'unknown'

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

const isDevelopment = process.env['NODE_ENV'] === 'development'

/**
 * Loose per-IP volumetric backstop for login (30 / 15 min). The real
 * brute-force control is the per-ACCOUNT lockout in @mr/auth
 * (hooks/login-lockout.ts, keyed by email) — this IP layer only catches gross
 * spray/DoS and must stay loose enough NOT to collateral-block multiple accounts
 * behind one shared (e.g. office / Cloudflare) IP. Gross per-IP abuse is also
 * throttled at the Cloudflare edge. Dev: relaxed so local retries never lock.
 */
export const loginRateLimiter = createRateLimiter(
  isDevelopment ? { windowMs: 60_000, max: 100 } : { windowMs: 15 * 60_000, max: 30 },
)

export const claimReportExportRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  keyOf: (c) => {
    const user = c.get('user')
    if (user === null) {
      return 'claim-report-export:anonymous'
    }
    return `claim-report-export:${user.id}`
  },
})

export const excelExportRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: isDevelopment || process.env['NODE_ENV'] === 'test' ? 100 : 3,
  keyOf: (c) => {
    const user = c.get('user')
    if (user === null) {
      return 'excel-export:anonymous'
    }
    return `excel-export:${user.id}`
  },
})

/** Employee self-signup: 3 attempts per hour per IP (docs/05). */
export const signupRateLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: isDevelopment || process.env['NODE_ENV'] === 'test' ? 100 : 3,
})

/** Portal client self-registration: 3 attempts per hour per IP (mirrors signup). */
export const clientRegistrationRateLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: isDevelopment || process.env['NODE_ENV'] === 'test' ? 100 : 3,
})

/** Portal activation completion: 10 attempts per hour per IP (allows password retries). */
export const activationRateLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: isDevelopment || process.env['NODE_ENV'] === 'test' ? 100 : 10,
})

/** Portal client ticket submissions: 20 per hour per user (docs/18 §5; logged-in only). */
export const clientSubmissionRateLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: isDevelopment || process.env['NODE_ENV'] === 'test' ? 1000 : 20,
  keyOf: (c) => {
    const user = c.get('user')
    if (user === null) {
      return 'client-submission:anonymous'
    }
    return `client-submission:${user.id}`
  },
})
