import type { Logger } from '@mr/logger'
import { ERROR_CODE } from '@mr/shared'
import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { requireRoles } from '../core/auth/require-roles.js'
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

function testUser(roles: string[], permissions: string[] = []): MRSessionUser {
  return { id: 'u-1', roles, permissions } as MRSessionUser
}

describe('requireRoles', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 when user is null', async () => {
    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', null)
      await next()
    })
    app.get('/x', requireRoles('admin'), (c) => c.text('ok'))

    const res = await app.request('/x')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODE.Unauthorized)
  })

  it('returns 403 when user has none of the allowed roles', async () => {
    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', testUser(['viewer']))
      await next()
    })
    app.get('/x', requireRoles('admin', 'operator'), (c) => c.text('ok'))

    const res = await app.request('/x')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODE.Forbidden)
  })

  it('passes when user has one of the allowed roles', async () => {
    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', testUser(['operator']))
      await next()
    })
    app.get('/x', requireRoles('admin', 'operator'), (c) => c.text('ok'))

    const res = await app.request('/x')
    expect(res.status).toBe(200)
  })

  it('passes when user has multiple roles including an allowed match', async () => {
    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', testUser(['viewer', 'admin']))
      await next()
    })
    app.get('/x', requireRoles('admin'), (c) => c.text('ok'))

    const res = await app.request('/x')
    expect(res.status).toBe(200)
  })

  it('in non-production, error message includes required and user roles', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', testUser(['viewer']))
      await next()
    })
    app.get('/x', requireRoles('admin'), (c) => c.text('ok'))

    const res = await app.request('/x')
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toContain('Required roles:')
    expect(body.error.message).toContain('admin')
    expect(body.error.message).toContain('viewer')
  })

  it('in production, error message is generic', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', testUser(['viewer']))
      await next()
    })
    app.get('/x', requireRoles('admin'), (c) => c.text('ok'))

    const res = await app.request('/x')
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe('Insufficient role')
  })
})
