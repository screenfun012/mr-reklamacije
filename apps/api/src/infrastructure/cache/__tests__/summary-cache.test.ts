import type { Redis } from 'ioredis'
import { describe, expect, it } from 'vitest'

import { RedisCache } from '../redis-cache.js'
import { SummaryCache, SUMMARY_CACHE_TTL_SECONDS } from '../summary-cache.js'

class FakeRedis {
  readonly store = new Map<string, string>()
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }
  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, value)
    return 'OK'
  }
  async del(...keys: string[]): Promise<number> {
    let removed = 0
    for (const key of keys) if (this.store.delete(key)) removed += 1
    return removed
  }
  async incr(key: string): Promise<number> {
    const next = Number(this.store.get(key) ?? '0') + 1
    this.store.set(key, String(next))
    return next
  }
}

const enabledCache = (): SummaryCache =>
  new SummaryCache(new RedisCache(new FakeRedis() as unknown as Redis))

describe('SummaryCache — Redis disabled', () => {
  it('always computes (no caching) when Redis is disabled', async () => {
    const cache = new SummaryCache(new RedisCache(null))
    let calls = 0
    const compute = async (): Promise<{ n: number }> => {
      calls += 1
      return { n: calls }
    }
    await expect(cache.read('statistics', ['a'], 60, compute)).resolves.toEqual({ n: 1 })
    await expect(cache.read('statistics', ['a'], 60, compute)).resolves.toEqual({ n: 2 })
    expect(calls).toBe(2)
  })
})

describe('SummaryCache — Redis enabled', () => {
  it('computes once, then serves the same key from cache', async () => {
    const cache = enabledCache()
    let calls = 0
    const compute = async (): Promise<{ total: number }> => {
      calls += 1
      return { total: 42 }
    }
    const first = await cache.read(
      'statistics',
      ['emotive', true],
      SUMMARY_CACHE_TTL_SECONDS,
      compute,
    )
    const second = await cache.read(
      'statistics',
      ['emotive', true],
      SUMMARY_CACHE_TTL_SECONDS,
      compute,
    )
    expect(first).toEqual({ total: 42 })
    expect(second).toEqual({ total: 42 })
    expect(calls).toBe(1)
  })

  it('keeps separate entries for different key parts', async () => {
    const cache = enabledCache()
    let calls = 0
    const compute = async (): Promise<{ calls: number }> => {
      calls += 1
      return { calls }
    }
    await cache.read('statistics', ['a'], 60, compute)
    await cache.read('statistics', ['b'], 60, compute)
    expect(calls).toBe(2)
  })

  it('re-computes after invalidate() bumps the generation', async () => {
    const cache = enabledCache()
    let calls = 0
    const compute = async (): Promise<{ calls: number }> => {
      calls += 1
      return { calls }
    }
    await cache.read('dashboard', ['x'], 60, compute) // calls = 1, cached
    await cache.read('dashboard', ['x'], 60, compute) // served from cache
    expect(calls).toBe(1)

    await cache.invalidate()

    await cache.read('dashboard', ['x'], 60, compute) // generation bumped -> miss -> recompute
    expect(calls).toBe(2)
  })
})
