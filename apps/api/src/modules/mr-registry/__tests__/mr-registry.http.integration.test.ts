import { ClaimKind, ClaimOutcome, normalizeName } from '@mr/shared'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppVariables } from '../../../app.js'
import type { Container } from '../../../core/container.js'
import { registerGlobalErrorHandler } from '../../../core/middleware/error-handler.js'
import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { createTestEngineType } from '../../../test-helpers/engine-type-fixtures.js'
import { buildTestContainer, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { registerMrRegistryRoutes } from '../index.js'

function createMrRegistryTestApp(
  container: Container,
  user: ReturnType<typeof testUser> | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerMrRegistryRoutes(app, container)

  return app
}

describe('MrRegistry HTTP', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function seedEmotiveClaim(mrNumber: string): Promise<string> {
    const engineTypeId = (await createTestEngineType(container, `LK-${Date.now()}`)).id
    const created = await container.emotiveClaimsService.create(
      {
        engineTypeId,
        dateOfClaim: new Date('2026-04-17'),
        mrNumber,
        employeeId: await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Dejan Milovanović')),
        sourceId: await getClaimSourceIdByCode(ctx.db, 'SELMAN'),
        outcome: ClaimOutcome.Pending,
        faults: [],
        findings: [],
      },
      {
        id: TEST_USER_ID,
        permissions: ['emotive_claims.create'],
      },
      {
        actorUserId: TEST_USER_ID,
        actorIp: null,
        actorUserAgent: null,
      },
    )
    return created.id
  }

  describe('GET /api/mr-registry/lookup', () => {
    it('returns 401 without auth', async () => {
      const app = createMrRegistryTestApp(container, null)
      const res = await app.request('/api/mr-registry/lookup?mr=MR123/26')
      expect(res.status).toBe(401)
    })

    it('returns 403 without create permission on either module', async () => {
      const app = createMrRegistryTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request('/api/mr-registry/lookup?mr=MR123/26')
      expect(res.status).toBe(403)
    })

    it('returns existing claim after MR normalization', async () => {
      const mrNumber = `HTTP-LK-${crypto.randomUUID().slice(0, 8)}/26`
      const claimId = await seedEmotiveClaim(mrNumber)

      const app = createMrRegistryTestApp(container, testUser(['domace_claims.create']))
      const res = await app.request(
        `/api/mr-registry/lookup?mr=${encodeURIComponent(`  ${mrNumber.toUpperCase()}  `)}`,
      )

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        kind: ClaimKind.Emotive,
        claimId,
      })
    })

    it('returns null when MR is not registered', async () => {
      const app = createMrRegistryTestApp(container, testUser(['emotive_claims.create']))
      const res = await app.request('/api/mr-registry/lookup?mr=NEPOSTOJECI-MR/26')

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toBeNull()
    })
  })
})
