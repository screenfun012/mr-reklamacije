import {
  createLoginAttemptStore,
  LOGIN_LOCKOUT_MS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  normalizeEmail,
  type LoginAttemptStore,
} from '@mr/auth'
import type { Logger } from '@mr/logger'
import type { Redis } from 'ioredis'

/**
 * recordFailure in one atomic Lua call over [failKey, lockKey]:
 *  - INCR the failure counter; on the FIRST failure set its TTL to the counting
 *    window, so the count auto-decays (replacing the in-memory rolling-window reset).
 *  - once the count reaches MAX, SET the lock key with the lockout TTL.
 * One script closes the crash-between-INCR-and-EXPIRE orphaned-key hole.
 */
const RECORD_FAILURE_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
if count >= tonumber(ARGV[3]) then
  redis.call('SET', KEYS[2], '1', 'PX', tonumber(ARGV[2]))
end
return count
`

/**
 * Redis-backed {@link LoginAttemptStore} — the shared-across-replicas swap the
 * interface was designed for. Policy (5 failures / 15-min window / 15-min lock) is
 * imported from @mr/auth so it stays byte-for-byte identical to the in-memory store.
 * Every native TTL replaces the in-memory Map's sweeper: nothing leaks.
 *
 * Fail-safe: any Redis error delegates to a composed in-memory fallback (real
 * per-replica lockout during an outage), so a dead/slow Redis never breaks login.
 */
export function createRedisLoginAttemptStore(
  redis: Redis,
  keyPrefix: string,
  logger?: Logger,
): LoginAttemptStore {
  const fallback = createLoginAttemptStore()
  const k = (key: string): string => (keyPrefix === '' ? key : `${keyPrefix}.${key}`)
  const failKey = (email: string): string => k(`login.fail.${normalizeEmail(email)}`)
  const lockKey = (email: string): string => k(`login.lock.${normalizeEmail(email)}`)

  return {
    async checkLocked(email: string): Promise<number | null> {
      try {
        const ttlMs = await redis.pttl(lockKey(email))
        return ttlMs > 0 ? Math.ceil(ttlMs / 1000) : null
      } catch (err) {
        logger?.warn({ err }, 'redis login checkLocked failed — falling back to in-memory')
        return fallback.checkLocked(email)
      }
    },

    async recordFailure(email: string): Promise<void> {
      try {
        await redis.eval(
          RECORD_FAILURE_LUA,
          2,
          failKey(email),
          lockKey(email),
          String(LOGIN_WINDOW_MS),
          String(LOGIN_LOCKOUT_MS),
          String(LOGIN_MAX_FAILURES),
        )
      } catch (err) {
        logger?.warn({ err }, 'redis login recordFailure failed — falling back to in-memory')
        await fallback.recordFailure(email)
      }
    },

    async recordSuccess(email: string): Promise<void> {
      try {
        await redis.del(failKey(email), lockKey(email))
      } catch (err) {
        logger?.warn({ err }, 'redis login recordSuccess failed — falling back to in-memory')
        await fallback.recordSuccess(email)
      }
    },
  }
}
