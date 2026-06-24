import { schema } from '@mr/db'
import { ClaimOutcome, normalizeName } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ForbiddenError } from '../../../core/errors/domain-errors.js'
import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import {
  buildTestContainer,
  createStatisticsTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { StatisticsActor } from '../statistics.types.js'

const FULL_STATISTICS: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_emotive', 'statistics.view_domace'],
}

const EMOTIVE_ONLY: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_emotive'],
}

const NO_STATISTICS = testUser(['emotive_claims.view', 'domace_claims.view'])

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

function daysAgo(days: number): Date {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

describe('Statistics module integration', () => {
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

  async function createEmotiveClaim(
    mrNumber: string,
    outcome: (typeof ClaimOutcome)[keyof typeof ClaimOutcome] = ClaimOutcome.Accepted,
    dateOfClaim: Date = daysAgo(10),
  ): Promise<string> {
    const engineType = await container.engineTypesRepository.create({
      code: `STAT-${Date.now()}-${mrNumber}`,
    })

    const claim = await container.emotiveClaimsService.create(
      {
        engineTypeId: engineType.id,
        dateOfClaim,
        mrNumber,
        outcome,
        warrantyReport: 'Statistics test',
        employeeId: await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Dejan Milovanović')),
        sourceId: await getClaimSourceIdByCode(ctx.db, 'SELMAN'),
        faults: [],
      },
      {
        id: TEST_USER_ID,
        permissions: ['emotive_claims.view', 'emotive_claims.create', 'domace_claims.view'],
      },
      auditContext,
    )

    return claim.id
  }

  async function createDomaceClaim(
    mrNumber: string,
    dateOfClaim: Date = daysAgo(20),
  ): Promise<string> {
    const claim = await container.domaceClaimsService.create(
      {
        mrNumber,
        customerName: 'Stats Domace',
        dateOfClaim,
        outcome: ClaimOutcome.Accepted,
        totalAmount: 100000,
        faults: [],
      },
      {
        id: TEST_USER_ID,
        permissions: ['domace_claims.view', 'domace_claims.create', 'emotive_claims.view'],
      },
      auditContext,
    )

    return claim.id
  }

  describe('when loading statistics summary', () => {
    it('returns monthly and yearly counts for emotive and domace claims', async () => {
      await createEmotiveClaim('STAT-EMO/26')
      await createDomaceClaim('STAT-DOM/26')

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)

      expect(summary.trends.byMonth.length).toBe(24)
      expect(summary.trends.byYear.some((row) => row.emotive >= 1 && row.domace >= 1)).toBe(true)
      const recentMonth = summary.trends.byMonth.at(-1)
      expect(recentMonth?.total).toBeGreaterThanOrEqual(2)
    })

    it('excludes archived claims from trend aggregates', async () => {
      const before = await container.statisticsService.getSummary(FULL_STATISTICS)
      const activeId = await createEmotiveClaim('STAT-ACTIVE/26')
      const archivedId = await createEmotiveClaim('STAT-ARCH/26')

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Archived })
        .where(eq(schema.emotiveClaims.id, archivedId))

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)

      expect(summary.trends.byMonth.at(-1)?.total).toBe(before.trends.byMonth.at(-1)!.total + 1)
      expect(activeId).toBeDefined()
    })

    it('scopes monthly domace counts to statistics.view_domace permission', async () => {
      await createEmotiveClaim('STAT-EMO-SCOPE/26')
      await createDomaceClaim('STAT-DOM-SCOPE/26')

      const summary = await container.statisticsService.getSummary(EMOTIVE_ONLY)
      const recentMonth = summary.trends.byMonth.at(-1)

      expect(recentMonth?.emotive).toBeGreaterThanOrEqual(1)
      expect(recentMonth?.domace).toBe(0)
    })

    it('throws ForbiddenError without statistics permissions', async () => {
      await expect(container.statisticsService.getSummary(NO_STATISTICS)).rejects.toBeInstanceOf(
        ForbiddenError,
      )
    })
  })

  describe('HTTP', () => {
    it('returns 403 without statistics permissions', async () => {
      const app = createStatisticsTestApp(container, NO_STATISTICS)

      const response = await app.request('/api/statistics/summary')

      expect(response.status).toBe(403)
    })

    it('returns summary JSON for authorized users', async () => {
      const app = createStatisticsTestApp(
        container,
        testUser(['statistics.view_emotive', 'statistics.view_domace']),
      )
      await createEmotiveClaim('STAT-HTTP/26')

      const response = await app.request('/api/statistics/summary')

      expect(response.status).toBe(200)
      const body: unknown = await response.json()
      expect(body).toMatchObject({
        trends: {
          byMonth: expect.any(Array),
          byYear: expect.any(Array),
          volumeTrend: {
            direction: expect.stringMatching(/rising|falling|stable/),
          },
        },
      })
    })
  })
})
