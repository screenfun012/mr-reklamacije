import { schema } from '@mr/db'
import { ClaimOutcome, normalizeName, STATISTICS_UNKNOWN_MANUFACTURER_CODE } from '@mr/shared'
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

  async function createEngineManufacturer(code: string, name: string): Promise<string> {
    const created = await container.engineManufacturersRepository.create({ code, name })
    return created.id
  }

  async function createEmotiveClaim(
    mrNumber: string,
    outcome: (typeof ClaimOutcome)[keyof typeof ClaimOutcome] = ClaimOutcome.Accepted,
    dateOfClaim: Date = daysAgo(10),
    manufacturerId?: string,
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
        ...(manufacturerId !== undefined ? { manufacturerId } : {}),
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
    manufacturerId?: string,
  ): Promise<string> {
    const claim = await container.domaceClaimsService.create(
      {
        mrNumber,
        customerName: 'Stats Domace',
        dateOfClaim,
        outcome: ClaimOutcome.Accepted,
        totalAmount: 100000,
        faults: [],
        ...(manufacturerId !== undefined ? { manufacturerId } : {}),
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

  describe('when loading manufacturer statistics', () => {
    it('groups active claims by manufacturer with outcome counts', async () => {
      const bmwId = await createEngineManufacturer(`STAT-BMW-${Date.now()}`, 'BMW Stats')
      const audiId = await createEngineManufacturer(`STAT-AUDI-${Date.now()}`, 'Audi Stats')

      await createEmotiveClaim('STAT-MFG-1/26', ClaimOutcome.Accepted, daysAgo(10), bmwId)
      await createEmotiveClaim('STAT-MFG-2/26', ClaimOutcome.Pending, daysAgo(12), bmwId)
      await createEmotiveClaim('STAT-MFG-3/26', ClaimOutcome.Rejected, daysAgo(8), audiId)

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const bmw = summary.byManufacturer.items.find((row) => row.manufacturerId === bmwId)
      const audi = summary.byManufacturer.items.find((row) => row.manufacturerId === audiId)

      expect(bmw).toMatchObject({ total: 2, pending: 1, accepted: 1, rejected: 0 })
      expect(audi).toMatchObject({ total: 1, rejected: 1 })
      expect(summary.byManufacturer.items[0]?.total).toBeGreaterThanOrEqual(
        summary.byManufacturer.items[1]?.total ?? 0,
      )
    })

    it('includes unknown segment for null manufacturer_id', async () => {
      await createEmotiveClaim('STAT-UNK-1/26', ClaimOutcome.Accepted, daysAgo(9))

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const unknown = summary.byManufacturer.items.find(
        (row) => row.code === STATISTICS_UNKNOWN_MANUFACTURER_CODE,
      )

      expect(unknown).toMatchObject({
        manufacturerId: null,
        total: expect.any(Number),
      })
      expect(unknown?.total).toBeGreaterThanOrEqual(1)
    })

    it('excludes archived claims from manufacturer aggregates', async () => {
      const manufacturerId = await createEngineManufacturer(
        `STAT-ARCH-MFG-${Date.now()}`,
        'Arch MFG',
      )
      const before = await container.statisticsService.getSummary(FULL_STATISTICS)
      const beforeCount =
        before.byManufacturer.items.find((row) => row.manufacturerId === manufacturerId)?.total ?? 0

      const activeId = await createEmotiveClaim(
        'STAT-MFG-ACTIVE/26',
        ClaimOutcome.Accepted,
        daysAgo(11),
        manufacturerId,
      )
      const archivedId = await createEmotiveClaim(
        'STAT-MFG-ARCH/26',
        ClaimOutcome.Accepted,
        daysAgo(11),
        manufacturerId,
      )

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Archived })
        .where(eq(schema.emotiveClaims.id, archivedId))

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const row = summary.byManufacturer.items.find((row) => row.manufacturerId === manufacturerId)

      expect(row?.total).toBe(beforeCount + 1)
      expect(activeId).toBeDefined()
    })

    it('scopes manufacturer domace counts to statistics.view_domace permission', async () => {
      const manufacturerId = await createEngineManufacturer(
        `STAT-SCOPE-MFG-${Date.now()}`,
        'Scope MFG',
      )

      await createEmotiveClaim(
        'STAT-MFG-EMO-SCOPE/26',
        ClaimOutcome.Accepted,
        daysAgo(10),
        manufacturerId,
      )
      await createDomaceClaim('STAT-MFG-DOM-SCOPE/26', daysAgo(10), manufacturerId)

      const summary = await container.statisticsService.getSummary(EMOTIVE_ONLY)
      const row = summary.byManufacturer.items.find(
        (entry) => entry.manufacturerId === manufacturerId,
      )

      expect(row?.total).toBe(1)
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
        byManufacturer: {
          items: expect.any(Array),
        },
      })
    })
  })
})
