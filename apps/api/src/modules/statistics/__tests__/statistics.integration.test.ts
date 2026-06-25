import { schema } from '@mr/db'
import {
  ClaimKind,
  ClaimOutcome,
  normalizeName,
  STATISTICS_UNKNOWN_MANUFACTURER_CODE,
} from '@mr/shared'
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

function daysAgo(days: number): Date {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

function dateInYear(year: number, month: number, day: number): Date {
  return new Date(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`,
  )
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
    sourceCode: string = 'SELMAN',
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
        sourceId: await getClaimSourceIdByCode(ctx.db, sourceCode),
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
    engineTypeId?: string | null,
    outcome: (typeof ClaimOutcome)[keyof typeof ClaimOutcome] = ClaimOutcome.Accepted,
    employeeId?: string,
  ): Promise<string> {
    const claim = await container.domaceClaimsService.create(
      {
        mrNumber,
        customerName: 'Stats Domace',
        dateOfClaim,
        outcome,
        totalAmount: 100000,
        faults: [],
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
        { manufacturerId: bmwId },
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
        bySource: {
          items: expect.any(Array),
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
    it('groups emotive claims by claim source', async () => {
      await createEmotiveClaim(
        'STAT-SRC-1/26',
        ClaimOutcome.Accepted,
        daysAgo(9),
        undefined,
        'SELMAN',
      )
      await createEmotiveClaim(
        'STAT-SRC-2/26',
        ClaimOutcome.Accepted,
        daysAgo(8),
        undefined,
        'VITOBELLO',
      )

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const selman = summary.bySource.items.find((row) => row.code === 'SELMAN')
      const vitobello = summary.bySource.items.find((row) => row.code === 'VITOBELLO')

      expect(selman?.total).toBeGreaterThanOrEqual(1)
      expect(vitobello?.total).toBeGreaterThanOrEqual(1)
    })

    it('returns empty bySource for domace-only statistics scope', async () => {
      await createEmotiveClaim('STAT-SRC-DOM-ONLY/26')
      await createDomaceClaim('STAT-SRC-DOM-ONLY-D/26')

      const summary = await container.statisticsService.getSummary(DOMACE_ONLY)

      expect(summary.bySource.items).toEqual([])
    })

    it('includes unknown source segment for null source_id', async () => {
      const claimId = await createEmotiveClaim('STAT-SRC-UNK/26')
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ sourceId: null })
        .where(eq(schema.emotiveClaims.id, claimId))

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const unknown = summary.bySource.items.find(
        (row) => row.code === STATISTICS_UNKNOWN_MANUFACTURER_CODE,
      )

      expect(unknown).toMatchObject({ sourceId: null, total: expect.any(Number) })
      expect(unknown?.total).toBeGreaterThanOrEqual(1)
    })

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

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const employee = summary.byEmployee.items.find((row) => row.employeeId === employeeId)

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

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const unknown = summary.byEmployee.items.find(
        (row) => row.code === STATISTICS_UNKNOWN_MANUFACTURER_CODE,
      )

      expect(unknown).toMatchObject({ employeeId: null })
      expect(unknown?.total).toBeGreaterThanOrEqual(1)
    })

    it('groups claims by engine type including null engine_type_id', async () => {
      const engineType = await container.engineTypesRepository.create({
        code: `STAT-ET-${Date.now()}`,
      })

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
      const before = await container.statisticsService.getSummary(FULL_STATISTICS)
      const beforeSelman = before.bySource.items.find((row) => row.code === 'SELMAN')?.total ?? 0

      const activeId = await createEmotiveClaim('STAT-BRK-ACTIVE/26')
      const archivedId = await createEmotiveClaim('STAT-BRK-ARCH/26')

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Archived })
        .where(eq(schema.emotiveClaims.id, archivedId))

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS)
      const selman = summary.bySource.items.find((row) => row.code === 'SELMAN')

      expect(selman?.total).toBe(beforeSelman + 1)
      expect(activeId).toBeDefined()
    })

    it('scopes domace employee counts to statistics.view_domace permission', async () => {
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      const beforeEmotive = await container.statisticsService.getSummary(EMOTIVE_ONLY)
      const beforeFull = await container.statisticsService.getSummary(FULL_STATISTICS)
      const beforeEmotiveCount =
        beforeEmotive.byEmployee.items.find((row) => row.employeeId === employeeId)?.total ?? 0
      const beforeFullCount =
        beforeFull.byEmployee.items.find((row) => row.employeeId === employeeId)?.total ?? 0

      await createEmotiveClaim('STAT-EMP-SCOPE-1/26')
      await createDomaceClaim(
        'STAT-EMP-SCOPE-2/26',
        daysAgo(10),
        undefined,
        undefined,
        ClaimOutcome.Accepted,
        employeeId,
      )

      const emotiveOnly = await container.statisticsService.getSummary(EMOTIVE_ONLY)
      const full = await container.statisticsService.getSummary(FULL_STATISTICS)
      const emotiveRow = emotiveOnly.byEmployee.items.find((row) => row.employeeId === employeeId)
      const fullRow = full.byEmployee.items.find((row) => row.employeeId === employeeId)

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

    it('returns empty source breakdown for domace kind filter', async () => {
      await createEmotiveClaim('STAT-FIL-KIND-EMO/26')
      await createDomaceClaim('STAT-FIL-KIND-DOM/26')

      const summary = await container.statisticsService.getSummary(FULL_STATISTICS, {
        kind: ClaimKind.Domace,
      })

      expect(summary.bySource.items).toEqual([])
      expect(summary.trends.byMonth.at(-1)?.domace).toBeGreaterThanOrEqual(1)
      expect(summary.trends.byMonth.at(-1)?.emotive).toBe(0)
    })

    it('returns empty aggregates for filters with no matching claims', async () => {
      const summary = await container.statisticsService.getSummary(FULL_STATISTICS, { year: 2010 })

      expect(summary.trends.byMonth.every((row) => row.total === 0)).toBe(true)
      expect(summary.byManufacturer.items).toEqual([])
      expect(summary.outcomes.distribution.total).toBe(0)
      expect(summary.bySource.items).toEqual([])
      expect(summary.byEmployee.items).toEqual([])
      expect(summary.byEngineType.items).toEqual([])
    })

    it('intersects kind filter with permission scope', async () => {
      await createEmotiveClaim('STAT-FIL-SCOPE-EMO/26')
      await createDomaceClaim('STAT-FIL-SCOPE-DOM/26')

      const summary = await container.statisticsService.getSummary(EMOTIVE_ONLY, {
        kind: ClaimKind.Domace,
      })

      expect(summary.trends.byMonth.every((row) => row.total === 0)).toBe(true)
      expect(summary.bySource.items).toEqual([])
    })
  })
})
