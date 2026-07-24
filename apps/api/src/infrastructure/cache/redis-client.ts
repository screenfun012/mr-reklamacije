import type { Logger } from '@mr/logger'
import { Redis } from 'ioredis'

import type { Env } from '../../config/env.js'

/**
 * Constructs the shared Redis client, or `null` when `REDIS_URL` is unset. Redis is
 * OPTIONAL: every Redis-backed feature falls back to in-memory/DB when this is null, so the
 * app behaves exactly as it did before Redis existed.
 *
 * Configured to DEGRADE GRACEFULLY: `enableOfflineQueue: false` makes commands fail fast
 * (the cache layer treats the rejection as a miss) instead of piling up while Redis is down,
 * while `retryStrategy` reconnects in the background. A connection error must NEVER crash the
 * process, so an `'error'` listener is attached (an unhandled `'error'` on the client would
 * be an EventEmitter throw).
 */
export function createRedisClient(env: Env, logger: Logger): Redis | null {
  if (env.REDIS_URL === undefined) return null

  const client = new Redis(env.REDIS_URL, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  })

  client.on('error', (err) => {
    logger.warn({ err }, 'redis client error')
  })

  return client
}
