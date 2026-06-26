import type { Context } from 'hono'
import { describe, expect, it } from 'vitest'

import {
  createSignupOriginGuard,
  resolveRequestOrigin,
} from '../core/middleware/signup-origin-guard.js'

function mockContext(headers: Record<string, string>): Context {
  return {
    req: {
      header(name: string) {
        return headers[name.toLowerCase()]
      },
    },
    json: (body: unknown, status: number) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  } as unknown as Context
}

describe('resolveRequestOrigin', () => {
  it('prefers Origin header', () => {
    const origin = resolveRequestOrigin(mockContext({ origin: 'http://localhost:3002' }))
    expect(origin).toBe('http://localhost:3002')
  })

  it('falls back to Referer origin', () => {
    const origin = resolveRequestOrigin(mockContext({ referer: 'http://localhost:3002/register' }))
    expect(origin).toBe('http://localhost:3002')
  })

  it('returns null when neither header is present', () => {
    expect(resolveRequestOrigin(mockContext({}))).toBeNull()
  })
})

describe('createSignupOriginGuard', () => {
  const guard = createSignupOriginGuard(['http://localhost:3002'])

  it('allows signup from internal origin', async () => {
    let called = false
    await guard(mockContext({ origin: 'http://localhost:3002' }), async () => {
      called = true
    })
    expect(called).toBe(true)
  })

  it('rejects signup from admin origin with 403', async () => {
    await expect(
      guard(mockContext({ origin: 'http://localhost:3001' }), async () => undefined),
    ).rejects.toMatchObject({ status: 403 })
  })
})
