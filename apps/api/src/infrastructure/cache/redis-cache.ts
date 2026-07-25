import type { Logger } from '@mr/logger'
import type { Redis } from 'ioredis'

/**
 * Atomic fixed-window counter. INCRs the key and — only on the FIRST hit (count===1)
 * — sets its TTL, so the window is anchored at the first request and never slides.
 * Returns the count plus remaining TTL. Doing INCR+PEXPIRE in one Lua call closes the
 * "INCR succeeds, EXPIRE fails → key never expires → caller locked out forever" hole.
 */
const FIXED_WINDOW_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`

/**
 * Thin, fail-safe wrapper over the shared Redis client. Every method SWALLOWS a null client
 * (Redis disabled) and any runtime error (Redis down): a cache is a best-effort optimization,
 * never a dependency — reads return a miss, writes no-op, so callers always fall back to the
 * database. This is what keeps Redis from becoming a new single point of failure.
 *
 * Every key is namespaced by `keyPrefix` (env-scoped; prod carries a secret guard — see
 * `resolveCacheKeyPrefix`), so one shared Redis can serve prod/dev/staging without collisions.
 */
export class RedisCache {
  constructor(
    private readonly client: Redis | null,
    private readonly logger?: Logger,
    private readonly keyPrefix = '',
  ) {}

  get enabled(): boolean {
    return this.client !== null
  }

  private k(key: string): string {
    return this.keyPrefix === '' ? key : `${this.keyPrefix}.${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.client === null) return null
    try {
      const raw = await this.client.get(this.k(key))
      if (raw === null) return null
      const parsed: unknown = JSON.parse(raw)
      return parsed as T
    } catch (err) {
      this.logger?.warn({ err, key }, 'redis get failed')
      return null
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (this.client === null) return
    try {
      await this.client.set(this.k(key), JSON.stringify(value), 'EX', ttlSeconds)
    } catch (err) {
      this.logger?.warn({ err, key }, 'redis set failed')
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (this.client === null || keys.length === 0) return
    try {
      await this.client.del(...keys.map((key) => this.k(key)))
    } catch (err) {
      this.logger?.warn({ err, keys }, 'redis del failed')
    }
  }

  /** Atomically increments a counter (used for cache-generation invalidation). 0 on failure. */
  async incr(key: string): Promise<number> {
    if (this.client === null) return 0
    try {
      return await this.client.incr(this.k(key))
    } catch (err) {
      this.logger?.warn({ err, key }, 'redis incr failed')
      return 0
    }
  }

  /** Reads an integer counter; 0 when missing, disabled, or on error. */
  async getNumber(key: string): Promise<number> {
    if (this.client === null) return 0
    try {
      const raw = await this.client.get(this.k(key))
      if (raw === null) return 0
      const value = Number(raw)
      return Number.isFinite(value) ? value : 0
    } catch (err) {
      this.logger?.warn({ err, key }, 'redis getNumber failed')
      return 0
    }
  }

  /**
   * One fixed-window rate-limit hit for `namespace`+`key`. Returns `{count, ttlMs}`,
   * or `null` when Redis is disabled OR errors — the discriminable miss the caller
   * needs to fall back to its in-memory bucket (NOT fail-open). `namespace` keeps
   * limiters that share a key shape (e.g. `ip:<addr>`) from colliding on one Redis.
   */
  async fixedWindowHit(
    namespace: string,
    key: string,
    windowMs: number,
  ): Promise<{ count: number; ttlMs: number } | null> {
    if (this.client === null) return null
    try {
      const result = (await this.client.eval(
        FIXED_WINDOW_LUA,
        1,
        this.k(`rl:${namespace}:${key}`),
        String(windowMs),
      )) as [number, number]
      return { count: result[0], ttlMs: result[1] }
    } catch (err) {
      this.logger?.warn({ err, namespace }, 'redis fixedWindowHit failed')
      return null
    }
  }

  async dispose(): Promise<void> {
    if (this.client === null) return
    try {
      await this.client.quit()
    } catch {
      this.client.disconnect()
    }
  }
}
