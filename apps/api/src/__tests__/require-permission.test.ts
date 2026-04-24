import type { PermissionResolver } from '@mr/auth'
import type { Logger } from '@mr/logger'
import { ERROR_CODE } from '@mr/shared'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { requirePermission } from '../core/auth/require-permission.js'
import { registerGlobalErrorHandler } from '../core/middleware/error-handler.js'

function makeApp() {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Logger

  const app = new Hono<{ Variables: { user: { id: string } | null } }>()
  registerGlobalErrorHandler(app, logger)
  return app
}

describe('requirePermission', () => {
  it('returns 401 when no user in context', async () => {
    const resolver = {
      getEffectiveForUser: vi.fn(),
      hasPermission: vi.fn(),
    } as unknown as PermissionResolver

    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', null)
      await next()
    })
    app.get(
      '/protected',
      requirePermission('emotive_claims.view', resolver),
      (c) => c.text('ok'),
    )

    const res = await app.request('/protected')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODE.Unauthorized)
  })

  it('returns 403 when user lacks permission', async () => {
    const resolver = {
      getEffectiveForUser: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue(false),
    } as unknown as PermissionResolver

    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', { id: 'u-1' })
      await next()
    })
    app.get(
      '/protected',
      requirePermission('emotive_claims.view', resolver),
      (c) => c.text('ok'),
    )

    const res = await app.request('/protected')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODE.Forbidden)
  })

  it('allows request when user has permission', async () => {
    const resolver = {
      getEffectiveForUser: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue(true),
    } as unknown as PermissionResolver

    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', { id: 'u-1' })
      await next()
    })
    app.get(
      '/protected',
      requirePermission('emotive_claims.view', resolver),
      (c) => c.text('ok'),
    )

    const res = await app.request('/protected')
    expect(res.status).toBe(200)
    expect(resolver.hasPermission).toHaveBeenCalledWith('u-1', 'emotive_claims.view')
  })
})
