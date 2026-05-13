import type { Logger } from '@mr/logger'
import { ERROR_CODE } from '@mr/shared'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { requireAuth } from '../core/auth/require-auth.js'
import type { MRSessionUser } from '../core/auth/session-types.js'
import { registerGlobalErrorHandler } from '../core/middleware/error-handler.js'

function fakeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Logger
}

function makeApp() {
  const app = new Hono<{ Variables: { user: MRSessionUser | null } }>()
  registerGlobalErrorHandler(app, fakeLogger())
  return app
}

function testUser(roles: string[], permissions: string[]): MRSessionUser {
  return { id: 'u-1', roles, permissions } as MRSessionUser
}

describe('requireAuth', () => {
  it('returns 401 when user is null', async () => {
    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', null)
      await next()
    })
    app.get('/x', requireAuth(), (c) => c.text('ok'))

    const res = await app.request('/x')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODE.Unauthorized)
  })

  it('passes through when user is set', async () => {
    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', testUser([], []))
      await next()
    })
    app.get('/x', requireAuth(), (c) => c.text('ok'))

    const res = await app.request('/x')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
})
