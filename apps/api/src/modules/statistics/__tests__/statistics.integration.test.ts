import { schema } from '@mr/db'
import {
  ClaimKind,
  ClaimOutcome,
  ExternalPartyKind,
  FaultType,
  normalizeName,
  STATISTICS_UNKNOWN_MANUFACTURER_CODE,
  type EmotiveClaimCreateInput,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ForbiddenError } from '../../../core/errors/domain-errors.js'
import {
  ensureTestUser,
  getClaimCategoryIdByCode,
  getClaimSourceIdByCode,
  getDepartmentIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { createTestEngineType } from '../../../test-helpers/engine-type-fixtures.js'
import {
  buildTestContainer,
  createStatisticsTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { RedisCache } from '../../../infrastructure/cache/redis-cache.js'
import { SummaryCache } from '../../../infrastructure/cache/summary-cache.js'
import { StatisticsService } from '../statistics.service.js'
import type { StatisticsActor } from '../statistics.types.js'

const FULL_STATISTICS: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_emotive', 'statistics.view_domace'],
}

const EMOTIVE_ONLY: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_emotive'],
}

/**
 * The two above deliberately do NOT hold `statistics.view_financial` — it is what everything else
 * in this suite reads with, and it proves the amounts stay withheld by default. Only the tests that
 * are ABOUT the amounts use this one.
 */
const WITH_MONEY: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_emotive', 'statistics.view_domace', 'statistics.view_financial'],
}

const EMOTIVE_ONLY_WITH_MONEY: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_emotive', 'statistics.view_financial'],
}

/**
 * Same arrangement as the money above, for the same reason: the actors this suite reads with by
 * default do NOT hold `employees.view_analytics`, so the withholding is what has to be asked for.
 * Only the tests that are ABOUT the per-person figures use these.
 */
const WITH_ANALYTICS: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_emotive', 'statistics.view_domace', 'employees.view_analytics'],
}

const EMOTIVE_ONLY_WITH_ANALYTICS: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_emotive', 'employees.view_analytics'],
}

const DOMACE_ONLY_WITH_ANALYTICS: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_domace', 'employees.view_analytics'],
}

const DOMACE_ONLY: StatisticsActor = {
  id: TEST_USER_ID,
  permissions: ['statistics.view_domace'],
}

const NO_STATISTICS = testUser(['emotive_claims.view', 'domace_claims.view'])

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

// The rolling trend window is SQL-driven (CURRENT_DATE in statistics-claim-filter),
// not JS-driven, so vi.setSystemTime cannot move it. Clamp claim dates to the first
// of the current month so daysAgo(N) never spills into the previous month bucket
// (which broke on days 1..N of a month). See CLAUDE.md §Testing time note.
function daysAgo(days: number): Date {
  const now = new Date()
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0)
  return date < firstOfMonth ? firstOfMonth : date
}

function dateInYear(year: number, month: number, day: number): Date {
  return new Date(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`,
  )
}

describe('Statistics module integration', () => {
  let ctx: TestDbContext
  let container: Container
  // Every claim built below now MUST carry categoryId (spec §3.3) — resolved once per
  // test from the migration-seeded catalog row. Category is irrelevant to what this
  // suite measures, so every helper below just reuses the same one.
  let defaultCategoryId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
    defaultCategoryId = await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA')
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
    sourceCode: string = 'SELMAN',
  ): Promise<string> {
    const engineType = await createTestEngineType(
      container,
      `STAT-${Date.now()}-${mrNumber}`,
      manufacturerId,
    )

    const claim = await container.emotiveClaimsService.create(
      {
        engineTypeId: engineType.id,
        categoryId: defaultCategoryId,
        dateOfClaim,
        mrNumber,
        outcome,
        warrantyReport: 'Statistics test',
        employeeId: await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Dejan Milovanović')),
        sourceId: await getClaimSourceIdByCode(ctx.db, sourceCode),
        faults: [],
        findings: [],
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
    engineTypeId?: string | null,
    outcome: (typeof ClaimOutcome)[keyof typeof ClaimOutcome] = ClaimOutcome.Accepted,
    employeeId?: string,
  ): Promise<string> {
    const claim = await container.domaceClaimsService.create(
      {
        mrNumber,
        categoryId: defaultCategoryId,
        customerName: 'Stats Domace',
        dateOfClaim,
        outcome,
        partsAmount: 100000,
        faults: [],
        findings: [],
        ...(manufacturerId !== undefined ? { manufacturerId } : {}),
        ...(engineTypeId !== undefined ? { engineTypeId: engineTypeId ?? undefined } : {}),
        ...(employeeId !== undefined ? { employeeId } : {}),
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

    it('counts domace claims after PATCH with only manufacturer_id', async () => {
      const bmwId = await createEngineManufacturer(`STAT-BMW-PATCH-${Date.now()}`, 'BMW Patch Only')
      const claimId = await createDomaceClaim(
        `STAT-MFG-PATCH-${Date.now()}/26`,
        daysAgo(10),
        undefined,
        undefined,
        ClaimOutcome.Pending,
      )

      await container.domaceClaimsService.update(
        claimId,
        { categoryId: defaultCategoryId, manufacturerId: bmwId },
        {
          id: TEST_USER_ID,
          permissions: ['domace_claims.view', 'domace_claims.update', 'emotive_claims.view'],
        },
        auditContext,
      )

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const bmw = summary.byManufacturer.items.find((row) => row.manufacturerId === bmwId)

      expect(bmw).toMatchObject({ total: 1, pending: 1 })
    })

    it('counts domace claims with manufacturer_id but null engine_type_id', async () => {
      const bmwId = await createEngineManufacturer(
        `STAT-BMW-NO-ET-${Date.now()}`,
        'BMW No Engine Type',
      )

      await createDomaceClaim(`STAT-MFG-NO-ET-${Date.now()}/26`, daysAgo(10), bmwId, null)

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const bmw = summary.byManufacturer.items.find((row) => row.manufacturerId === bmwId)

      expect(bmw).toMatchObject({ total: 1, accepted: 1 })
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
        // Holds the analytics action too: this asserts the SHAPE of the whole body, and the
        // per-person sections are `null` without it (their own tests cover that).
        testUser(['statistics.view_emotive', 'statistics.view_domace', 'employees.view_analytics']),
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
        outcomes: {
          distribution: expect.objectContaining({
            pending: expect.any(Number),
            accepted: expect.any(Number),
            rejected: expect.any(Number),
            total: expect.any(Number),
          }),
          processingTime: expect.objectContaining({
            sampleSize: expect.any(Number),
          }),
          acceptanceRateByMonth: expect.any(Array),
        },
        byEmployee: {
          items: expect.any(Array),
        },
        byEngineType: {
          items: expect.any(Array),
        },
      })
    })

    it('accepts year filter query params', async () => {
      const app = createStatisticsTestApp(
        container,
        testUser(['statistics.view_emotive', 'statistics.view_domace']),
      )
      await createEmotiveClaim(
        'STAT-HTTP-YEAR-IN/25',
        ClaimOutcome.Accepted,
        dateInYear(2025, 3, 10),
      )
      await createEmotiveClaim('STAT-HTTP-YEAR-OUT/26', ClaimOutcome.Accepted, daysAgo(5))

      const response = await app.request('/api/statistics/summary?year=2025')

      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        trends: { byMonth: Array<{ total: number }> }
        byManufacturer: { items: Array<{ total: number }> }
      }
      const filteredTotal = body.trends.byMonth.reduce((sum, row) => sum + row.total, 0)
      const unfiltered = await app.request('/api/statistics/summary')
      const unfilteredBody = (await unfiltered.json()) as {
        trends: { byMonth: Array<{ total: number }> }
      }
      const unfilteredTotal = unfilteredBody.trends.byMonth.reduce((sum, row) => sum + row.total, 0)

      expect(filteredTotal).toBeGreaterThanOrEqual(1)
      expect(filteredTotal).toBeLessThan(unfilteredTotal)
      expect(body.trends.byMonth).toHaveLength(12)
      expect(body.byManufacturer.items.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('when loading outcome statistics', () => {
    it('returns global outcome distribution counts', async () => {
      await createEmotiveClaim('STAT-OUT-DIST-1/26', ClaimOutcome.Pending, daysAgo(10))
      await createEmotiveClaim('STAT-OUT-DIST-2/26', ClaimOutcome.Accepted, daysAgo(12))
      await createEmotiveClaim('STAT-OUT-DIST-3/26', ClaimOutcome.Rejected, daysAgo(8))

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const { distribution } = summary.outcomes

      expect(distribution.total).toBeGreaterThanOrEqual(3)
      expect(distribution.pending).toBeGreaterThanOrEqual(1)
      expect(distribution.accepted).toBeGreaterThanOrEqual(1)
      expect(distribution.rejected).toBeGreaterThanOrEqual(1)
      expect(distribution.total).toBe(
        distribution.pending + distribution.accepted + distribution.rejected,
      )
    })

    it('computes processing time only for resolved claims', async () => {
      const before = await container.statisticsService.getSummary(FULL_STATISTICS)
      await createEmotiveClaim('STAT-OUT-PROC-PEND/26', ClaimOutcome.Pending, daysAgo(15))
      await createEmotiveClaim('STAT-OUT-PROC-ACC/26', ClaimOutcome.Accepted, daysAgo(10))

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)

      expect(summary.outcomes.processingTime.sampleSize).toBe(
        before.outcomes.processingTime.sampleSize + 1,
      )
      expect(summary.outcomes.processingTime.averageDays).not.toBeNull()
      expect(summary.outcomes.processingTime.medianDays).not.toBeNull()
      expect(summary.outcomes.processingTime.maxDays).toBeGreaterThanOrEqual(0)
    })

    it('returns acceptance rate by month for resolved claims', async () => {
      await createEmotiveClaim('STAT-OUT-RATE-ACC/26', ClaimOutcome.Accepted, daysAgo(5))
      await createEmotiveClaim('STAT-OUT-RATE-REJ/26', ClaimOutcome.Rejected, daysAgo(5))

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const currentMonth = summary.outcomes.acceptanceRateByMonth.at(-1)

      expect(summary.outcomes.acceptanceRateByMonth).toHaveLength(24)
      expect(currentMonth?.decided).toBeGreaterThanOrEqual(2)
      expect(currentMonth?.ratePercent).not.toBeNull()
    })

    it('excludes archived claims from outcome distribution', async () => {
      const before = await container.statisticsService.getSummary(FULL_STATISTICS)
      const archivedId = await createEmotiveClaim('STAT-OUT-ARCH/26', ClaimOutcome.Accepted)

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Archived })
        .where(eq(schema.emotiveClaims.id, archivedId))

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)

      expect(summary.outcomes.distribution.total).toBe(before.outcomes.distribution.total)
    })

    it('scopes domace outcome counts to statistics.view_domace permission', async () => {
      await createEmotiveClaim('STAT-OUT-EMO-SCOPE/26', ClaimOutcome.Accepted, daysAgo(7))
      await createDomaceClaim('STAT-OUT-DOM-SCOPE/26', daysAgo(7))

      const full = await container.statisticsService.getSummary(FULL_STATISTICS)
      const emotiveOnly = await container.statisticsService.getSummary(EMOTIVE_ONLY)

      expect(full.outcomes.distribution.total).toBeGreaterThan(
        emotiveOnly.outcomes.distribution.total,
      )
      expect(emotiveOnly.outcomes.processingTime.sampleSize).toBeLessThan(
        full.outcomes.processingTime.sampleSize,
      )
    })
  })

  describe('when loading breakdown statistics', () => {
    it('aggregates assigned employee_id across emotive and domace claims', async () => {
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )

      await createEmotiveClaim('STAT-EMP-1/26', ClaimOutcome.Accepted, daysAgo(10))
      await createDomaceClaim(
        'STAT-EMP-2/26',
        daysAgo(11),
        undefined,
        undefined,
        ClaimOutcome.Accepted,
        employeeId,
      )

      const summary = await container.statisticsService.getSummary(WITH_ANALYTICS)
      const employee = summary.byEmployee?.items.find((row) => row.employeeId === employeeId)

      expect(employee?.total).toBeGreaterThanOrEqual(2)
    })

    it('includes unknown employee segment for null employee_id', async () => {
      await createDomaceClaim(
        'STAT-EMP-UNK/26',
        daysAgo(9),
        undefined,
        undefined,
        ClaimOutcome.Accepted,
        undefined,
      )

      const summary = await container.statisticsService.getSummary(WITH_ANALYTICS)
      const unknown = summary.byEmployee?.items.find(
        (row) => row.code === STATISTICS_UNKNOWN_MANUFACTURER_CODE,
      )

      expect(unknown).toMatchObject({ employeeId: null })
      expect(unknown?.total).toBeGreaterThanOrEqual(1)
    })

    it('groups claims by engine type including null engine_type_id', async () => {
      const engineType = await createTestEngineType(container, `STAT-ET-${Date.now()}`)

      await createEmotiveClaim('STAT-ET-1/26', ClaimOutcome.Accepted, daysAgo(10))
      await createDomaceClaim('STAT-ET-2/26', daysAgo(11), undefined, engineType.id)
      await createDomaceClaim('STAT-ET-UNK/26', daysAgo(12), undefined, null)

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const typed = summary.byEngineType.items.find((row) => row.engineTypeId === engineType.id)
      const unknown = summary.byEngineType.items.find(
        (row) => row.code === STATISTICS_UNKNOWN_MANUFACTURER_CODE,
      )

      expect(typed?.total).toBeGreaterThanOrEqual(1)
      expect(unknown?.total).toBeGreaterThanOrEqual(1)
    })

    it('excludes archived claims from breakdown aggregates', async () => {
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      const before = await container.statisticsService.getSummary(WITH_ANALYTICS)
      const beforeCount =
        before.byEmployee?.items.find((row) => row.employeeId === employeeId)?.total ?? 0

      const activeId = await createEmotiveClaim('STAT-BRK-ACTIVE/26')
      const archivedId = await createEmotiveClaim('STAT-BRK-ARCH/26')

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Archived })
        .where(eq(schema.emotiveClaims.id, archivedId))

      const summary = await container.statisticsService.getSummary(WITH_ANALYTICS)
      const after = summary.byEmployee?.items.find((row) => row.employeeId === employeeId)

      expect(after?.total).toBe(beforeCount + 1)
      expect(activeId).toBeDefined()
    })

    it('scopes domace employee counts to statistics.view_domace permission', async () => {
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      const beforeEmotive = await container.statisticsService.getSummary(
        EMOTIVE_ONLY_WITH_ANALYTICS,
      )
      const beforeFull = await container.statisticsService.getSummary(WITH_ANALYTICS)
      const beforeEmotiveCount =
        beforeEmotive.byEmployee?.items.find((row) => row.employeeId === employeeId)?.total ?? 0
      const beforeFullCount =
        beforeFull.byEmployee?.items.find((row) => row.employeeId === employeeId)?.total ?? 0

      await createEmotiveClaim('STAT-EMP-SCOPE-1/26')
      await createDomaceClaim(
        'STAT-EMP-SCOPE-2/26',
        daysAgo(10),
        undefined,
        undefined,
        ClaimOutcome.Accepted,
        employeeId,
      )

      const emotiveOnly = await container.statisticsService.getSummary(EMOTIVE_ONLY_WITH_ANALYTICS)
      const full = await container.statisticsService.getSummary(WITH_ANALYTICS)
      const emotiveRow = emotiveOnly.byEmployee?.items.find((row) => row.employeeId === employeeId)
      const fullRow = full.byEmployee?.items.find((row) => row.employeeId === employeeId)

      expect(emotiveRow?.total).toBe(beforeEmotiveCount + 1)
      expect(fullRow?.total).toBe(beforeFullCount + 2)
    })
  })

  describe('when applying summary filters', () => {
    it('limits aggregates to the selected claim year', async () => {
      await createEmotiveClaim(
        'STAT-FIL-YEAR-IN/25',
        ClaimOutcome.Accepted,
        dateInYear(2025, 4, 12),
      )
      await createEmotiveClaim('STAT-FIL-YEAR-OUT/26', ClaimOutcome.Accepted, daysAgo(4))

      const filtered = await container.statisticsService.getSummary(FULL_STATISTICS, { year: 2025 })
      const unfiltered = await container.statisticsService.getSummary(FULL_STATISTICS, {})

      const filteredTotal = filtered.trends.byMonth.reduce((sum, row) => sum + row.total, 0)
      const unfilteredTotal = unfiltered.trends.byMonth.reduce((sum, row) => sum + row.total, 0)

      expect(filtered.trends.byMonth).toHaveLength(12)
      expect(filteredTotal).toBeGreaterThanOrEqual(1)
      expect(filteredTotal).toBeLessThan(unfilteredTotal)
      expect(filtered.trends.byYear).toEqual([
        expect.objectContaining({ year: 2025, total: expect.any(Number) }),
      ])
    })

    it('limits aggregates to the selected manufacturer', async () => {
      const bmwId = await createEngineManufacturer(`STAT-FIL-BMW-${Date.now()}`, 'BMW Filter')
      const audiId = await createEngineManufacturer(`STAT-FIL-AUDI-${Date.now()}`, 'Audi Filter')

      await createEmotiveClaim('STAT-FIL-MFG-1/26', ClaimOutcome.Accepted, daysAgo(8), bmwId)
      await createEmotiveClaim('STAT-FIL-MFG-2/26', ClaimOutcome.Accepted, daysAgo(7), audiId)

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS, {
        manufacturerId: bmwId,
      })

      expect(summary.byManufacturer.items).toEqual([
        expect.objectContaining({ manufacturerId: bmwId, total: 1 }),
      ])
      expect(summary.byManufacturer.items.some((row) => row.manufacturerId === audiId)).toBe(false)
    })

    it('applies the domace kind filter to trends', async () => {
      await createEmotiveClaim('STAT-FIL-KIND-EMO/26')
      await createDomaceClaim('STAT-FIL-KIND-DOM/26')

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS, {
        kind: ClaimKind.Domace,
      })

      expect(summary.trends.byMonth.at(-1)?.domace).toBeGreaterThanOrEqual(1)
      expect(summary.trends.byMonth.at(-1)?.emotive).toBe(0)
    })

    it('returns empty aggregates for filters with no matching claims', async () => {
      const summary = await container.statisticsService.getSummary(WITH_ANALYTICS, { year: 2010 })

      expect(summary.trends.byMonth.every((row) => row.total === 0)).toBe(true)
      expect(summary.byManufacturer.items).toEqual([])
      expect(summary.outcomes.distribution.total).toBe(0)
      expect(summary.byEmployee?.items).toEqual([])
      expect(summary.byEngineType.items).toEqual([])
    })

    it('intersects kind filter with permission scope', async () => {
      await createEmotiveClaim('STAT-FIL-SCOPE-EMO/26')
      await createDomaceClaim('STAT-FIL-SCOPE-DOM/26')

      const summary = await container.statisticsService.getSummary(EMOTIVE_ONLY, {
        kind: ClaimKind.Domace,
      })

      expect(summary.trends.byMonth.every((row) => row.total === 0)).toBe(true)
    })
  })

  describe('when loading business-value sections', () => {
    // Container writes COMMIT through the pool (only ctx.db rolls back), so
    // claims persist across tests AND runs. Exact totals are still safe here:
    // every test creates its own manufacturer and filters the summary by
    // manufacturerId — all three new sections honor buildActiveClaimWhere.
    const runId = Date.now()

    async function createIsolatedManufacturer(tag: string): Promise<string> {
      return createEngineManufacturer(`STATBV-${tag}-${runId}`, `Stat BV ${tag} ${runId}`)
    }

    async function createDomaceBvClaim(
      manufacturerId: string,
      mrNumber: string,
      totalAmount: number | null,
      faults: EmotiveClaimCreateInput['faults'] = [],
    ): Promise<string> {
      const claim = await container.domaceClaimsService.create(
        {
          mrNumber,
          categoryId: defaultCategoryId,
          customerName: 'Stats Domace',
          dateOfClaim: daysAgo(15),
          outcome: ClaimOutcome.Accepted,
          manufacturerId,
          faults,
          findings: [],
          // total_amount (UKUPNO) is computed = parts + labor; drive it via parts.
          ...(totalAmount !== null ? { partsAmount: totalAmount } : {}),
        },
        {
          id: TEST_USER_ID,
          permissions: ['domace_claims.view', 'domace_claims.create', 'emotive_claims.view'],
        },
        auditContext,
      )
      return claim.id
    }

    async function createEmotiveBvClaim(
      manufacturerId: string,
      mrNumber: string,
      options: {
        customerId?: string
        outcome?: (typeof ClaimOutcome)[keyof typeof ClaimOutcome]
        faults?: EmotiveClaimCreateInput['faults']
      } = {},
    ): Promise<string> {
      const engineType = await createTestEngineType(
        container,
        `STATBV-ET-${runId}-${mrNumber}`,
        manufacturerId,
      )
      const claim = await container.emotiveClaimsService.create(
        {
          engineTypeId: engineType.id,
          categoryId: defaultCategoryId,
          dateOfClaim: daysAgo(10),
          mrNumber,
          outcome: options.outcome ?? ClaimOutcome.Accepted,
          warrantyReport: 'Statistics business-value test',
          sourceId: await getClaimSourceIdByCode(ctx.db, 'SELMAN'),
          manufacturerId,
          faults: options.faults ?? [],
          findings: [],
          ...(options.customerId !== undefined ? { customerId: options.customerId } : {}),
        },
        {
          id: TEST_USER_ID,
          permissions: ['emotive_claims.view', 'emotive_claims.create', 'domace_claims.view'],
        },
        auditContext,
      )
      return claim.id
    }

    it('sums domace total_amount for the filtered period', async () => {
      const manufacturerId = await createIsolatedManufacturer('AMT')
      await createDomaceBvClaim(manufacturerId, `STAT-AMT-1/${runId}`, 1500.5)
      await createDomaceBvClaim(manufacturerId, `STAT-AMT-2/${runId}`, 2499.25)
      await createDomaceBvClaim(manufacturerId, `STAT-AMT-NONE/${runId}`, null)
      await createEmotiveBvClaim(manufacturerId, `STAT-AMT-EMO/${runId}`)

      const summary = await container.statisticsService.getSummary(WITH_MONEY, {
        manufacturerId,
      })

      expect(summary.domaceAmounts).toEqual({ totalAmount: 3999.75, claimCount: 2 })
    })

    it('returns zero domace amounts outside the domace scope', async () => {
      const manufacturerId = await createIsolatedManufacturer('AMTSC')
      await createDomaceBvClaim(manufacturerId, `STAT-AMT-SCOPE/${runId}`, 1000)

      const summary = await container.statisticsService.getSummary(EMOTIVE_ONLY_WITH_MONEY, {
        manufacturerId,
      })

      expect(summary.domaceAmounts).toEqual({ totalAmount: 0, claimCount: 0 })
    })

    /**
     * `statistics.view_financial` sat in the catalog since day one with nothing reading it, so
     * every operator and viewer saw the amounts. Withheld as `null`, never as zeros: zero is a
     * statement about the business ("no amounts were entered") and this is a statement about the
     * reader.
     */
    it('withholds the amounts from a reader without the financial permission', async () => {
      const manufacturerId = await createIsolatedManufacturer('AMTNO')
      await createDomaceBvClaim(manufacturerId, `STAT-AMT-NOFIN/${runId}`, 1234.5)

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS, {
        manufacturerId,
      })

      expect(summary.domaceAmounts).toBeNull()
      // Everything he is allowed to see still arrives.
      expect(summary.outcomes.distribution.total).toBeGreaterThan(0)
    })

    /**
     * The guard that pins WHERE the withholding happens, and it needs a LIVE cache to mean
     * anything: `SummaryCache.read` short-circuits to `compute()` whenever Redis is disabled, which
     * it is for the rest of this suite — so the same test written against `container.statisticsService`
     * passes whether the amounts are stripped before or after the cache. (Measured: it did.)
     *
     * With a cache actually enabled, the placement is the whole game. The summary is keyed by scope
     * and filters and deliberately NOT per user, so stripping inside `compute()` would let whoever
     * read first decide what the second reader sees — in either direction.
     */
    it('does not let a permitted reader warm the amounts into an unpermitted one', async () => {
      const manufacturerId = await createIsolatedManufacturer('AMTCACHE')
      await createDomaceBvClaim(manufacturerId, `STAT-AMT-CACHE/${runId}`, 777.25)

      const entries = new Map<string, unknown>()
      const liveCache = {
        enabled: true,
        get: async (key: string) => entries.get(key) ?? null,
        set: async (key: string, value: unknown) => {
          entries.set(key, value)
        },
        incr: async () => 1,
        getNumber: async () => 1,
      } as unknown as RedisCache

      const cached = new StatisticsService(
        container.statisticsRepository,
        new SummaryCache(liveCache),
      )

      const warmed = await cached.getSummary(WITH_MONEY, { manufacturerId })
      expect(warmed.domaceAmounts).toEqual({ totalAmount: 777.25, claimCount: 1 })
      expect(entries.size).toBe(1)

      const second = await cached.getSummary(FULL_STATISTICS, { manufacturerId })
      expect(second.domaceAmounts).toBeNull()
      // Served from the very entry the first read wrote — not recomputed around the problem.
      expect(entries.size).toBe(1)

      // And the reverse: a withheld read must not poison the permitted one either.
      const third = await cached.getSummary(WITH_MONEY, { manufacturerId })
      expect(third.domaceAmounts).toEqual({ totalAmount: 777.25, claimCount: 1 })
    })

    it('groups emotive claims by customer with outcome counts', async () => {
      const manufacturerId = await createIsolatedManufacturer('CUST')
      const customerName = `Stat Partner ${runId}`
      const customer = await container.customersRepository.create({ name: customerName })
      await createEmotiveBvClaim(manufacturerId, `STAT-CUST-1/${runId}`, {
        customerId: customer.id,
        outcome: ClaimOutcome.Accepted,
      })
      await createEmotiveBvClaim(manufacturerId, `STAT-CUST-2/${runId}`, {
        customerId: customer.id,
        outcome: ClaimOutcome.Rejected,
      })
      await createEmotiveBvClaim(manufacturerId, `STAT-CUST-NULL/${runId}`, {
        outcome: ClaimOutcome.Pending,
      })

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS, {
        manufacturerId,
      })

      expect(summary.byCustomer.items).toEqual([
        {
          customerId: customer.id,
          code: customer.id,
          name: customerName,
          total: 2,
          pending: 0,
          accepted: 1,
          rejected: 1,
        },
        {
          customerId: null,
          code: 'UNKNOWN',
          name: 'Nepoznato',
          total: 1,
          pending: 1,
          accepted: 0,
          rejected: 0,
        },
      ])
    })

    it('returns empty byCustomer for domace-only statistics scope', async () => {
      const manufacturerId = await createIsolatedManufacturer('CUSTSC')
      await createEmotiveBvClaim(manufacturerId, `STAT-CUST-SCOPE/${runId}`)

      const summary = await container.statisticsService.getSummary(DOMACE_ONLY, {
        manufacturerId,
      })

      expect(summary.byCustomer.items).toEqual([])
    })

    it('attributes faults to employees, departments and external parties across kinds', async () => {
      const manufacturerId = await createIsolatedManufacturer('FAULT')
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      const departmentId = await getDepartmentIdByCode(ctx.db, 'BLOKOVI')
      const externalParty = await container.externalPartiesRepository.create({
        name: `Stat Dobavljač ${runId}`,
        kind: ExternalPartyKind.Supplier,
      })

      await createEmotiveBvClaim(manufacturerId, `STAT-FAULT-EMO/${runId}`, {
        faults: [
          { faultType: FaultType.Employee, employeeId },
          { faultType: FaultType.Department, departmentId },
        ],
      })
      await createDomaceBvClaim(manufacturerId, `STAT-FAULT-DOM/${runId}`, null, [
        { faultType: FaultType.External, externalPartyId: externalParty.id },
        { faultType: FaultType.Employee, employeeId },
      ])

      const summary = await container.statisticsService.getSummary(WITH_ANALYTICS, {
        manufacturerId,
      })

      expect(summary.byFaults.byEmployee).toEqual([
        { id: employeeId, code: employeeId, name: 'Dejan Milovanović', total: 2 },
      ])
      expect(summary.byFaults.byDepartment).toEqual([
        { id: departmentId, code: departmentId, name: 'Blokovi', total: 1 },
      ])
      expect(summary.byFaults.byExternalParty).toEqual([
        {
          id: externalParty.id,
          code: externalParty.id,
          name: `Stat Dobavljač ${runId}`,
          total: 1,
        },
      ])
    })

    it('scopes fault attribution to the permitted claim kinds', async () => {
      const manufacturerId = await createIsolatedManufacturer('FAULTSC')
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      await createEmotiveBvClaim(manufacturerId, `STAT-FAULT-SCOPE/${runId}`, {
        faults: [{ faultType: FaultType.Employee, employeeId }],
      })

      const summary = await container.statisticsService.getSummary(DOMACE_ONLY_WITH_ANALYTICS, {
        manufacturerId,
      })

      expect(summary.byFaults.byEmployee).toEqual([])
      expect(summary.byFaults.byDepartment).toEqual([])
      expect(summary.byFaults.byExternalParty).toEqual([])
    })

    /**
     * `employees.view_analytics` sat in the catalog with nothing reading it, so anyone who could
     * open Statistika could read how many faults each named worker was blamed for.
     *
     * Withheld as `null`, never as an empty list — for the reason the money is: an empty list is a
     * statement about the shop ("nobody was blamed for anything"), and this is a statement about
     * the reader.
     *
     * Departments and external parties stay: a department is not a person, and the permission is
     * named after the thing it protects.
     */
    it('withholds the per-person figures from a reader without the analytics permission', async () => {
      const manufacturerId = await createIsolatedManufacturer('ANANO')
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      const departmentId = await getDepartmentIdByCode(ctx.db, 'BLOKOVI')

      await createEmotiveBvClaim(manufacturerId, `STAT-ANA-NO/${runId}`, {
        faults: [
          { faultType: FaultType.Employee, employeeId },
          { faultType: FaultType.Department, departmentId },
        ],
      })

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS, {
        manufacturerId,
      })

      expect(summary.byFaults.byEmployee).toBeNull()
      expect(summary.byEmployee).toBeNull()

      // What is not about a named person still arrives, and so does the rest of the screen.
      expect(summary.byFaults.byDepartment).toEqual([
        { id: departmentId, code: departmentId, name: 'Blokovi', total: 1 },
      ])
      expect(summary.outcomes.distribution.total).toBeGreaterThan(0)
    })

    /**
     * The placement guard, and it needs a LIVE cache to mean anything — `SummaryCache.read`
     * short-circuits to `compute()` while Redis is off, which it is everywhere else in this suite,
     * so the same test against `container.statisticsService` would pass with the withholding on
     * either side of the cache. The summary is keyed by scope and filters and deliberately NOT per
     * user, so stripping inside `compute()` would let whoever read first decide what the second
     * reader sees.
     */
    it('does not let a permitted reader warm the per-person figures into an unpermitted one', async () => {
      const manufacturerId = await createIsolatedManufacturer('ANACACHE')
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )

      await createEmotiveBvClaim(manufacturerId, `STAT-ANA-CACHE/${runId}`, {
        faults: [{ faultType: FaultType.Employee, employeeId }],
      })

      const entries = new Map<string, unknown>()
      const liveCache = {
        enabled: true,
        get: async (key: string) => entries.get(key) ?? null,
        set: async (key: string, value: unknown) => {
          entries.set(key, value)
        },
        incr: async () => 1,
        getNumber: async () => 1,
      } as unknown as RedisCache

      const cached = new StatisticsService(
        container.statisticsRepository,
        new SummaryCache(liveCache),
      )

      const warmed = await cached.getSummary(WITH_ANALYTICS, { manufacturerId })
      expect(warmed.byFaults.byEmployee).toEqual([
        { id: employeeId, code: employeeId, name: 'Dejan Milovanović', total: 1 },
      ])
      expect(entries.size).toBe(1)

      const second = await cached.getSummary(FULL_STATISTICS, { manufacturerId })
      expect(second.byFaults.byEmployee).toBeNull()
      expect(second.byEmployee).toBeNull()
      // Served from the very entry the first read wrote — not recomputed around the problem.
      expect(entries.size).toBe(1)

      // And the reverse: a withheld read must not poison the permitted one either.
      const third = await cached.getSummary(WITH_ANALYTICS, { manufacturerId })
      expect(third.byFaults.byEmployee).toHaveLength(1)
    })
  })
})
