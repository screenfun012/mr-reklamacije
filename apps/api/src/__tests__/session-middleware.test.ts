import type { Auth } from '@mr/auth'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { createSessionMiddleware } from '../core/auth/session-middleware.js'

describe('session middleware', () => {
  it('sets user and session on authenticated request', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@test.com' },
      session: { id: 'session-1', token: 'tok', expiresAt: new Date() },
    }
    const auth = {
      api: {
        getSession: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as Auth

    const app = new Hono<{ Variables: { user: unknown; session: unknown } }>()
    app.use('*', createSessionMiddleware(auth))
    app.get('/whoami', (c) => c.json({ user: c.get('user') }))

    const res = await app.request('/whoami')
    const body = (await res.json()) as { user: unknown }
    expect(body.user).toEqual(mockSession.user)
  })

  it('sets null user and session when unauthenticated', async () => {
    const auth = {
      api: {
        getSession: vi.fn().mockResolvedValue(null),
      },
    } as unknown as Auth

    const app = new Hono<{ Variables: { user: unknown; session: unknown } }>()
    app.use('*', createSessionMiddleware(auth))
    app.get('/whoami', (c) => c.json({ user: c.get('user') }))

    const res = await app.request('/whoami')
    const body = (await res.json()) as { user: unknown }
    expect(body.user).toBeNull()
  })
})
