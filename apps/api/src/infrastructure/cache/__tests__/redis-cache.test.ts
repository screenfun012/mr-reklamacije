import type { Redis } from 'ioredis'
import { describe, expect, it } from 'vitest'

import { RedisCache } from '../redis-cache.js'

// Minimal in-memory stand-in for the subset of ioredis RedisCache calls. Tests may cast.
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
  async quit(): Promise<'OK'> {
    return 'OK'
  }
}

// Every command rejects — simulates Redis being down mid-request.
class ThrowingRedis {
  async get(): Promise<never> {
    throw new Error('redis down')
  }
  async set(): Promise<never> {
    throw new Error('redis down')
  }
  async del(): Promise<never> {
    throw new Error('redis down')
  }
  async incr(): Promise<never> {
    throw new Error('redis down')
  }
  async quit(): Promise<never> {
    throw new Error('redis down')
  }
  disconnect(): void {}
}

const asRedis = (fake: unknown): Redis => fake as Redis

describe('RedisCache — disabled (null client)', () => {
  const cache = new RedisCache(null)

  it('reports not enabled', () => {
    expect(cache.enabled).toBe(false)
  })

  it('reads as a miss and writes as a no-op without throwing', async () => {
    await expect(cache.get('k')).resolves.toBeNull()
    await expect(cache.set('k', { a: 1 }, 60)).resolves.toBeUndefined()
    await expect(cache.del('k')).resolves.toBeUndefined()
    await expect(cache.incr('gen')).resolves.toBe(0)
    await expect(cache.getNumber('gen')).resolves.toBe(0)
    await expect(cache.dispose()).resolves.toBeUndefined()
  })
})

describe('RedisCache — with a working client', () => {
  it('round-trips a JSON value', async () => {
    const cache = new RedisCache(asRedis(new FakeRedis()))
    expect(cache.enabled).toBe(true)
    await cache.set('claim:1', { total: 42, name: 'x' }, 60)
    await expect(cache.get<{ total: number; name: string }>('claim:1')).resolves.toEqual({
      total: 42,
      name: 'x',
    })
  })

  it('returns null for a missing key', async () => {
    const cache = new RedisCache(asRedis(new FakeRedis()))
    await expect(cache.get('nope')).resolves.toBeNull()
  })

  it('deletes keys', async () => {
    const cache = new RedisCache(asRedis(new FakeRedis()))
    await cache.set('a', 1, 60)
    await cache.del('a')
    await expect(cache.get('a')).resolves.toBeNull()
  })

  it('increments and reads a generation counter', async () => {
    const cache = new RedisCache(asRedis(new FakeRedis()))
    await expect(cache.incr('gen')).resolves.toBe(1)
    await expect(cache.incr('gen')).resolves.toBe(2)
    await expect(cache.getNumber('gen')).resolves.toBe(2)
  })
})

describe('RedisCache — client erroring (Redis down)', () => {
  const cache = new RedisCache(asRedis(new ThrowingRedis()))

  it('never throws — reads miss, writes no-op, counters read 0', async () => {
    await expect(cache.get('k')).resolves.toBeNull()
    await expect(cache.set('k', { a: 1 }, 60)).resolves.toBeUndefined()
    await expect(cache.del('k')).resolves.toBeUndefined()
    await expect(cache.incr('gen')).resolves.toBe(0)
    await expect(cache.getNumber('gen')).resolves.toBe(0)
  })
})
