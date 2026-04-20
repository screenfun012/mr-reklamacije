import type { Logger } from '@mr/logger'
import { ERROR_CODE } from '@mr/shared'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { registerGlobalErrorHandler } from '../core/middleware/error-handler.js'
import { createRateLimiter } from '../core/middleware/rate-limit.js'

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
})
