import type { Logger } from '@mr/logger'
import { Hono } from 'hono'
import type { Redis } from 'ioredis'
import { describe, expect, it, vi } from 'vitest'

import { registerGlobalErrorHandler } from '../core/middleware/error-handler.js'
import { createRateLimiter } from '../core/middleware/rate-limit.js'
import { RedisCache } from '../infrastructure/cache/redis-cache.js'

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Logger
}

/**
 * Map-backed fake of the fixed-window Lua: INCR the key, anchor its TTL on the
 * FIRST hit only, return [count, pttl]. One store instance = one Redis, so limiters
 * with distinct `name`s (distinct `rl:<name>:...` keys) don't collide on it.
 */
function fakeFixedWindowRedis(): Redis {
  const store = new Map<string, { count: number; expireAt: number }>()
  return {
    async eval(_script: string, _numKeys: number, key: string, windowMs: string) {
      const now = Date.now()
      const cur = store.get(key)
      if (!cur || cur.expireAt <= now) {
        store.set(key, { count: 1, expireAt: now + Number(windowMs) })
        return [1, Number(windowMs)]
      }
      cur.count += 1
      return [cur.count, cur.expireAt - now]
    },
  } as unknown as Redis
}

function throwingRedis(): Redis {
  return {
    async eval() {
      throw new Error('redis down')
    },
  } as unknown as Redis
}

describe('rate limiter (Redis-backed)', () => {
  it('limits via the shared counter and rejects past max with Retry-After', async () => {
    const cache = new RedisCache(fakeFixedWindowRedis())
    const app = new Hono()
    registerGlobalErrorHandler(app, makeLogger())
    app.use('*', createRateLimiter({ name: 'test', windowMs: 60_000, max: 2 }, cache))
    app.get('/', (c) => c.text('ok'))

    const call = () => app.request('/', { headers: { 'x-forwarded-for': '1.2.3.4' } })
    expect((await call()).status).toBe(200)
    expect((await call()).status).toBe(200)
    const rejected = await call()
    expect(rejected.status).toBe(429)
    expect(rejected.headers.get('Retry-After')).toBeDefined()
  })

  it('keeps limiters with distinct names on separate buckets (no shared-Redis collision)', async () => {
    const cache = new RedisCache(fakeFixedWindowRedis()) // ONE shared Redis store
    const app = new Hono()
    registerGlobalErrorHandler(app, makeLogger())
    app.use('/a', createRateLimiter({ name: 'a', windowMs: 60_000, max: 1 }, cache))
    app.use('/b', createRateLimiter({ name: 'b', windowMs: 60_000, max: 1 }, cache))
    app.get('/a', (c) => c.text('a'))
    app.get('/b', (c) => c.text('b'))

    // Same client → same key shape `ip:9.9.9.9`; only the `name` namespace separates them.
    const ip = { 'x-forwarded-for': '9.9.9.9' }
    expect((await app.request('/a', { headers: ip })).status).toBe(200)
    expect((await app.request('/a', { headers: ip })).status).toBe(429) // 'a' exhausted
    expect((await app.request('/b', { headers: ip })).status).toBe(200) // 'b' independent
  })

  it('falls back to the in-memory bucket when Redis errors (still limits, never opens)', async () => {
    const cache = new RedisCache(throwingRedis(), makeLogger())
    const app = new Hono()
    registerGlobalErrorHandler(app, makeLogger())
    app.use('*', createRateLimiter({ name: 'test', windowMs: 60_000, max: 1 }, cache))
    app.get('/', (c) => c.text('ok'))

    const ip = { 'x-forwarded-for': '2.2.2.2' }
    expect((await app.request('/', { headers: ip })).status).toBe(200)
    expect((await app.request('/', { headers: ip })).status).toBe(429)
  })
})
