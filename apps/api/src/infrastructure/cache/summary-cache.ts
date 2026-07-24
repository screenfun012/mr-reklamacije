import type { RedisCache } from './redis-cache.js'

export const SUMMARY_CACHE_TTL_SECONDS = 60

const GENERATION_KEY = 'summary:gen'

type KeyPart = string | number | boolean | null | undefined

/**
 * Generation-keyed read-through cache for the internal statistics & dashboard summaries
 * (docs/24). The cache key embeds a shared generation counter; `invalidate()` bumps it, so a
 * single INCR orphans EVERY cached summary at once (old keys fall out via TTL) — this preserves
 * today's behaviour where the numbers refresh the moment a claim changes, which a plain TTL
 * alone would not.
 *
 * Fully fail-safe: when Redis is disabled or down, `read()` just runs `compute()` (a normal DB
 * hit), exactly as before this cache existed. The cache is an optimization, never a dependency.
 */
export class SummaryCache {
  constructor(private readonly cache: RedisCache) {}

  async read<T>(
    namespace: string,
    keyParts: ReadonlyArray<KeyPart>,
    ttlSeconds: number,
    compute: () => Promise<T>,
  ): Promise<T> {
    if (!this.cache.enabled) return compute()

    const generation = await this.cache.getNumber(GENERATION_KEY)
    const key = `${namespace}:g${generation}:${JSON.stringify(keyParts)}`

    const cached = await this.cache.get<T>(key)
    if (cached !== null) return cached

    const result = await compute()
    await this.cache.set(key, result, ttlSeconds)
    return result
  }

  /** Bumps the shared generation so every cached summary is treated as stale on the next read. */
  async invalidate(): Promise<void> {
    await this.cache.incr(GENERATION_KEY)
  }
}
