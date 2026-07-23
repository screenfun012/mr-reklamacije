import { createHash } from 'node:crypto'

import { ERROR_CODE } from '@mr/shared'
import type { Context, MiddlewareHandler } from 'hono'

import { AppError } from '../errors/app-error.js'
import { clientIpOf } from '../http/client-ip.js'

interface RateLimitOptions {
  windowMs: number
  max: number
  /** Returning null skips this limiter for the request (another layer covers it). */
  keyOf?: (c: Context) => string | null
}

/**
 * Better-Auth names its session cookie `<prefix>.session_token`, and prepends
 * `__Secure-` once cookies are secure (production). Match on the suffix so the
 * key survives both spellings — and a future `cookiePrefix` change.
 */
const SESSION_COOKIE_SUFFIX = 'session_token'

/** Stable, non-reversible bucket id for a session cookie (never the raw token). */
function sessionKeyOf(c: Context): string | null {
  const header = c.req.header('cookie')
  if (header === undefined) {
    return null
  }

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')
    if (separator === -1) {
      continue
    }
    const name = pair.slice(0, separator).trim()
    if (!name.endsWith(SESSION_COOKIE_SUFFIX)) {
      continue
    }
    const value = pair.slice(separator + 1).trim()
    if (value === '') {
      continue
    }
    return createHash('sha256').update(value).digest('base64url').slice(0, 22)
  }

  return null
}

/** Per-IP key — the layer nobody can opt out of, since the caller cannot pick its address. */
export function ipKeyOf(c: Context): string {
  return `ip:${clientIpOf(c) ?? 'unknown'}`
}

/**
 * Per-session key, or null when the request carries no session cookie (the IP
 * layer alone covers those). The `s:` prefix keeps a hash from ever colliding
 * with an address.
 *
 * Deliberately NOT a fallback inside the IP limiter: a cookie is client-chosen,
 * so "key by cookie, else by IP" would let an anonymous caller mint a fresh
 * bucket per request just by rotating a made-up token. Session keying may only
 * ever ADD a limit, never replace one.
 */
export function sessionBucketKeyOf(c: Context): string | null {
  const session = sessionKeyOf(c)
  return session === null ? null : `s:${session}`
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

  const keyOf = options.keyOf ?? ipKeyOf

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
    if (key === null) {
      await next()
      return
    }

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

/**
 * Volumetric backstop against a flood from one address. NOT a per-person quota:
 * a whole office shares one public address behind NAT, and every server-rendered
 * page load arrives over the private network with no client-IP header at all, so
 * this bucket legitimately carries the traffic of everyone at once. Per-person
 * fairness is `sessionRateLimiter` below.
 */
export const generalRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 600,
})

/**
 * Per-person quota, applied ON TOP of the per-IP backstop for signed-in callers
 * (skipped entirely when there is no session cookie). This is what keeps one
 * runaway tab from spending everyone else's allowance — the failure mode the
 * per-IP limit alone could not distinguish from "the office is busy".
 */
export const sessionRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 120,
  keyOf: sessionBucketKeyOf,
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
