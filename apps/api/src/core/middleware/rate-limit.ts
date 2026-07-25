import { createHash } from 'node:crypto'

import { ERROR_CODE } from '@mr/shared'
import type { Context, MiddlewareHandler } from 'hono'

import { AppError } from '../errors/app-error.js'
import { clientIpOf } from '../http/client-ip.js'
import type { RedisCache } from '../../infrastructure/cache/redis-cache.js'

interface RateLimitOptions {
  windowMs: number
  max: number
  /** Returning null skips this limiter for the request (another layer covers it). */
  keyOf?: (c: Context) => string | null
  /**
   * Redis key namespace for this limiter. Required once a shared Redis backs the
   * counters: limiters that produce the same key shape (the five `ipKeyOf` ones all
   * emit `ip:<addr>`) would otherwise collide on one Redis. Irrelevant to the
   * in-memory path (each limiter owns its own Map).
   */
  name?: string
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

function rejectRateLimited(c: Context, retryAfterSec: number): never {
  c.header('Retry-After', String(retryAfterSec))
  throw new AppError(
    ERROR_CODE.RateLimited,
    429,
    `Too many requests. Retry after ${retryAfterSec}s.`,
  )
}

/**
 * Fixed-window rate limiter. Uses the shared Redis counter when `cache` is enabled
 * (so the limit holds across replicas), and ALWAYS keeps an in-memory Map as the
 * fallback for when Redis is absent (no `REDIS_URL`) or errors mid-request — the
 * fallback still limits per replica, it never fails open. Redis and in-memory use
 * the same anchored-at-first-hit, non-sliding window, so the behaviour is identical.
 */
export function createRateLimiter(
  options: RateLimitOptions,
  cache?: RedisCache,
): MiddlewareHandler {
  const buckets = new Map<string, Bucket>()

  const keyOf = options.keyOf ?? ipKeyOf
  const namespace = options.name ?? 'default'

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

    if (cache?.enabled) {
      const hit = await cache.fixedWindowHit(namespace, key, options.windowMs)
      // hit === null → Redis errored → fall through to the in-memory bucket below.
      if (hit !== null) {
        if (hit.count > options.max) {
          rejectRateLimited(c, Math.ceil((hit.ttlMs > 0 ? hit.ttlMs : options.windowMs) / 1000))
        }
        await next()
        return
      }
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
      rejectRateLimited(c, Math.ceil((bucket.resetAt - now) / 1000))
    }

    await next()
  }
}

const isDevelopment = process.env['NODE_ENV'] === 'development'
/** Dev and test relax the tight hourly/export caps so local retries never lock. */
const isRelaxed = isDevelopment || process.env['NODE_ENV'] === 'test'

/** Per-user export/submission key, with an anonymous bucket when no user is set. */
function userKeyOf(prefix: string): (c: Context) => string {
  return (c) => {
    const user = c.get('user')
    if (user === null) {
      return `${prefix}:anonymous`
    }
    return `${prefix}:${user.id}`
  }
}

/** Every rate limiter, built once against the shared cache (Redis-backed when enabled). */
export interface RateLimiters {
  /** Per-IP volumetric flood backstop — the whole office shares one NAT address. */
  general: MiddlewareHandler
  /** Per-signed-in-person quota, on top of the IP backstop. */
  session: MiddlewareHandler
  /** Per-IP sign-in backstop; the real brute-force control is the per-account lockout. */
  login: MiddlewareHandler
  /** Employee self-signup: 3/hour/IP (docs/05). */
  signup: MiddlewareHandler
  /** Portal client self-registration: 3/hour/IP. */
  clientRegistration: MiddlewareHandler
  /** Portal activation completion: 10/hour/IP (allows password retries). */
  activation: MiddlewareHandler
  /** Claim-report export: 5/min/user. */
  claimReportExport: MiddlewareHandler
  /** Excel export: 3/min/user. */
  excelExport: MiddlewareHandler
  /** Portal client ticket submissions: 20/hour/user (docs/18 §5; logged-in only). */
  clientSubmission: MiddlewareHandler
}

/**
 * Builds every rate limiter against the shared cache. Constructed in the DI container
 * (never a module singleton) so the limiters can reach the Redis cache. The distinct
 * per-limiter `name`s are mandatory: on ONE shared Redis the five ipKeyOf limiters all
 * emit `ip:<addr>` and would collide without a namespace (docs/24 Phase 3). Comments on
 * the individual limiters live on the `RateLimiters` interface above.
 */
export function createRateLimiters(cache: RedisCache): RateLimiters {
  return {
    general: createRateLimiter({ name: 'general', windowMs: 60_000, max: 600 }, cache),
    session: createRateLimiter(
      { name: 'session', windowMs: 60_000, max: 120, keyOf: sessionBucketKeyOf },
      cache,
    ),
    login: createRateLimiter(
      isDevelopment
        ? { name: 'login', windowMs: 60_000, max: 100 }
        : { name: 'login', windowMs: 15 * 60_000, max: 30 },
      cache,
    ),
    signup: createRateLimiter(
      { name: 'signup', windowMs: 60 * 60_000, max: isRelaxed ? 100 : 3 },
      cache,
    ),
    clientRegistration: createRateLimiter(
      { name: 'client-registration', windowMs: 60 * 60_000, max: isRelaxed ? 100 : 3 },
      cache,
    ),
    activation: createRateLimiter(
      { name: 'activation', windowMs: 60 * 60_000, max: isRelaxed ? 100 : 10 },
      cache,
    ),
    claimReportExport: createRateLimiter(
      {
        name: 'claim-report-export',
        windowMs: 60_000,
        max: 5,
        keyOf: userKeyOf('claim-report-export'),
      },
      cache,
    ),
    excelExport: createRateLimiter(
      {
        name: 'excel-export',
        windowMs: 60_000,
        max: isRelaxed ? 100 : 3,
        keyOf: userKeyOf('excel-export'),
      },
      cache,
    ),
    clientSubmission: createRateLimiter(
      {
        name: 'client-submission',
        windowMs: 60 * 60_000,
        max: isRelaxed ? 1000 : 20,
        keyOf: userKeyOf('client-submission'),
      },
      cache,
    ),
  }
}
