import type { Logger } from '@mr/logger'
import { ERROR_CODE } from '@mr/shared'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { registerGlobalErrorHandler } from '../core/middleware/error-handler.js'
import { createRateLimiter, sessionBucketKeyOf } from '../core/middleware/rate-limit.js'

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

describe('rate limiter', () => {
  it('allows requests under limit', async () => {
    const app = new Hono()
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 })
    app.use('*', limiter)
    app.get('/', (c) => c.text('ok'))

    for (let i = 0; i < 3; i++) {
      const res = await app.request('/', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })
      expect(res.status).toBe(200)
    }
  })

  it('rejects the 4th request with 429 and rate limit code', async () => {
    const app = new Hono()
    registerGlobalErrorHandler(app, makeLogger())
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 })
    app.use('*', limiter)
    app.get('/', (c) => c.text('ok'))

    for (let i = 0; i < 3; i++) {
      await app.request('/', {
        headers: { 'x-forwarded-for': '5.6.7.8' },
      })
    }

    const res = await app.request('/', {
      headers: { 'x-forwarded-for': '5.6.7.8' },
    })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeDefined()
    const body = (await res.json()) as {
      error: { code: string; message: string; status: number }
    }
    expect(body.error.code).toBe(ERROR_CODE.RateLimited)
    expect(body.error.status).toBe(429)
  })

  it('different IPs have separate buckets', async () => {
    const app = new Hono()
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })
    app.use('*', limiter)
    app.get('/', (c) => c.text('ok'))

    const res1 = await app.request('/', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })
    const res2 = await app.request('/', {
      headers: { 'x-forwarded-for': '10.0.0.2' },
    })

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
  })

  it('forged leftmost x-forwarded-for entries cannot bypass the limit', async () => {
    const app = new Hono()
    registerGlobalErrorHandler(app, makeLogger())
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })
    app.use('*', limiter)
    app.get('/', (c) => c.text('ok'))

    // Same real client (rightmost, proxy-appended), rotating forged prefixes.
    const res1 = await app.request('/', {
      headers: { 'x-forwarded-for': '6.6.6.1, 192.0.2.9' },
    })
    const res2 = await app.request('/', {
      headers: { 'x-forwarded-for': '6.6.6.2, 192.0.2.9' },
    })

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(429)
  })

  it('a rotating fake session cookie cannot buy a fresh per-IP bucket', async () => {
    const app = new Hono()
    registerGlobalErrorHandler(app, makeLogger())
    // The whole point of keeping the IP layer un-opt-out-able: cookies are
    // client-chosen, addresses are not.
    app.use('*', createRateLimiter({ windowMs: 60_000, max: 1 }))
    app.get('/', (c) => c.text('ok'))

    const attacker = { 'cf-connecting-ip': '192.0.2.77' }
    const first = await app.request('/', {
      headers: { ...attacker, cookie: 'better-auth.session_token=made-up-1' },
    })
    const second = await app.request('/', {
      headers: { ...attacker, cookie: 'better-auth.session_token=made-up-2' },
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
  })
})

describe('session rate limiter layer', () => {
  function appWithSessionLimit(max: number): Hono {
    const app = new Hono()
    registerGlobalErrorHandler(app, makeLogger())
    app.use('*', createRateLimiter({ windowMs: 60_000, max, keyOf: sessionBucketKeyOf }))
    app.get('/', (c) => c.text('ok'))
    return app
  }

  it('gives two signed-in people behind ONE office IP separate buckets', async () => {
    const app = appWithSessionLimit(1)
    const office = { 'cf-connecting-ip': '203.0.113.10' }

    const marko = await app.request('/', {
      headers: { ...office, cookie: 'better-auth.session_token=token-marko' },
    })
    const jelena = await app.request('/', {
      headers: { ...office, cookie: 'better-auth.session_token=token-jelena' },
    })

    expect(marko.status).toBe(200)
    expect(jelena.status).toBe(200)
  })

  it('keeps ONE bucket for a session that moves between addresses', async () => {
    const app = appWithSessionLimit(1)
    // Also covers the `__Secure-` prefix production actually sends.
    const cookie = '__Secure-better-auth.session_token=same-token'

    const first = await app.request('/', {
      headers: { 'cf-connecting-ip': '198.51.100.1', cookie },
    })
    const second = await app.request('/', {
      headers: { 'cf-connecting-ip': '198.51.100.2', cookie },
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
  })

  it('does not apply at all without a session cookie (the IP layer owns those)', async () => {
    const app = appWithSessionLimit(1)
    const anonymous = { 'cf-connecting-ip': '203.0.113.55', cookie: 'mrr:portal:theme=dark' }

    const first = await app.request('/', { headers: anonymous })
    const second = await app.request('/', { headers: anonymous })
    const third = await app.request('/', { headers: anonymous })

    expect([first.status, second.status, third.status]).toEqual([200, 200, 200])
  })
})
