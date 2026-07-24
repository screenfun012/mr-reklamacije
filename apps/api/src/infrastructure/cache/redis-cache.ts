import type { Logger } from '@mr/logger'
import type { Redis } from 'ioredis'

/**
 * Thin, fail-safe wrapper over the shared Redis client. Every method SWALLOWS a null client
 * (Redis disabled) and any runtime error (Redis down): a cache is a best-effort optimization,
 * never a dependency — reads return a miss, writes no-op, so callers always fall back to the
 * database. This is what keeps Redis from becoming a new single point of failure.
 */
export class RedisCache {
  constructor(
    private readonly client: Redis | null,
    private readonly logger?: Logger,
  ) {}

  get enabled(): boolean {
    return this.client !== null
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.client === null) return null
    try {
      const raw = await this.client.get(key)
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
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch (err) {
      this.logger?.warn({ err, key }, 'redis set failed')
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (this.client === null || keys.length === 0) return
    try {
      await this.client.del(...keys)
    } catch (err) {
      this.logger?.warn({ err, keys }, 'redis del failed')
    }
  }

  /** Atomically increments a counter (used for cache-generation invalidation). 0 on failure. */
  async incr(key: string): Promise<number> {
    if (this.client === null) return 0
    try {
      return await this.client.incr(key)
    } catch (err) {
      this.logger?.warn({ err, key }, 'redis incr failed')
      return 0
    }
  }

  /** Reads an integer counter; 0 when missing, disabled, or on error. */
  async getNumber(key: string): Promise<number> {
    if (this.client === null) return 0
    try {
      const raw = await this.client.get(key)
      if (raw === null) return 0
      const value = Number(raw)
      return Number.isFinite(value) ? value : 0
    } catch (err) {
      this.logger?.warn({ err, key }, 'redis getNumber failed')
      return 0
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
