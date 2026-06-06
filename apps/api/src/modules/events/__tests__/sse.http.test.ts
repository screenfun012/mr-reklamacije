import { ERROR_CODE } from '@mr/shared'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppVariables } from '../../../app.js'
import { createApp } from '../../../app.js'
import { requireAuth } from '../../../core/auth/require-auth.js'
import type { MRSessionUser } from '../../../core/auth/session-types.js'
import { registerGlobalErrorHandler } from '../../../core/middleware/error-handler.js'
import { TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { buildTestContainer, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { Container } from '../../../core/container.js'
import { registerEventsRoutes } from '../sse.routes.js'

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://mr:mr_dev_password@localhost:5433/mr_reklamacije'

function createEventsTestApp(container: Container, user: MRSessionUser | null) {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  app.use('*', async (c, next) => {
    if (c.req.path !== '/api/events/me') {
      return next()
    }
    return requireAuth()(c, next)
  })

  registerEventsRoutes(app, container)
  return app
}

describe('GET /api/events/me', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, DATABASE_URL)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('returns 401 without authentication', async () => {
    const app = createEventsTestApp(container, null)
    const res = await app.request('/api/events/me')

    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODE.Unauthorized)
  })

  it('returns 200 with text/event-stream for authenticated handshake', async () => {
    const app = createEventsTestApp(
      container,
      testUser(['emotive_claims.view'], TEST_USER_ID, ['operator']),
    )

    const abort = new AbortController()
    const abortTimer = setTimeout(() => abort.abort(), 150)

    const res = await app.request('/api/events/me', { signal: abort.signal })

    clearTimeout(abortTimer)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
  })

  it('is protected by global requireAuth in createApp', async () => {
    const app = createApp(buildTestContainer(ctx.db, ctx.pool, DATABASE_URL))

    const res = await app.request('/api/events/me')
    expect(res.status).toBe(401)
  })
})
