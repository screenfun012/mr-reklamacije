import { schema } from '@mr/db'
import { ClaimKind, ClaimOutcome, claimDetailPath, normalizeName } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ForbiddenError } from '../../../core/errors/domain-errors.js'
import { InProcessEventBus } from '../../events/in-process-event-bus.js'
import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { DashboardActor } from '../dashboard.types.js'

const FULL_OPERATOR: DashboardActor = {
  id: TEST_USER_ID,
  permissions: ['emotive_claims.view', 'domace_claims.view'],
}

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

describe('DashboardService integration', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new InProcessEventBus())
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function createEmotive(
    mrNumber: string,
    outcome: (typeof ClaimOutcome)[keyof typeof ClaimOutcome] = ClaimOutcome.Pending,
    dateOfClaim = daysAgo(365),
  ): Promise<string> {
    const engineType = await container.engineTypesRepository.create({
      code: `ENG-${Date.now()}-${mrNumber}`,
    })
    const created = await container.emotiveClaimsService.create(
      {
        engineTypeId: engineType.id,
        dateOfClaim,
        mrNumber,
        outcome,
        warrantyReport: 'Dashboard test emotive',
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
    return created.id
  }

  async function createDomace(
    mrNumber: string,
    outcome: (typeof ClaimOutcome)[keyof typeof ClaimOutcome] = ClaimOutcome.Pending,
    dateOfClaim: Date | null = daysAgo(365),
  ): Promise<string> {
    const created = await container.domaceClaimsService.create(
      {
        mrNumber,
        customerName: 'Dashboard Domace Kupac',
        dateOfClaim: dateOfClaim ?? undefined,
        outcome,
        faults: [],
      },
      {
        id: TEST_USER_ID,
        permissions: ['emotive_claims.view', 'domace_claims.create', 'domace_claims.view'],
      },
      auditContext,
    )
    return created.id
  }

  describe('when loading dashboard summary', () => {
    it('includes pending claims older than 7 days in overdue', async () => {
      const overdueId = await createEmotive('DASH-LATE/26', ClaimOutcome.Pending, daysAgo(365))
      await createEmotive('DASH-FRESH/26', ClaimOutcome.Pending, daysAgo(3))

      const summary = await container.dashboardService.getSummary(FULL_OPERATOR)

      expect(summary.overdue.some((item) => item.id === overdueId)).toBe(true)
      expect(summary.overdue.some((item) => item.mrNumber === 'DASH-FRESH/26')).toBe(false)
    })

    it('excludes accepted claims from overdue even when old', async () => {
      const acceptedId = await createEmotive('DASH-ACC/26', ClaimOutcome.Accepted, daysAgo(365))

      const summary = await container.dashboardService.getSummary(FULL_OPERATOR)

      expect(summary.overdue.some((item) => item.id === acceptedId)).toBe(false)
    })

    it('excludes archived and soft-deleted claims from stats and overdue', async () => {
      const before = await container.dashboardService.getSummary(FULL_OPERATOR)
      const activeId = await createEmotive('DASH-ACTIVE/26')
      const archivedId = await createEmotive('DASH-ARCH/26')
      const deletedId = await createEmotive('DASH-DEL/26')

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Archived })
        .where(eq(schema.emotiveClaims.id, archivedId))
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ deletedAt: new Date('2026-06-20T10:00:00Z') })
        .where(eq(schema.emotiveClaims.id, deletedId))

      const summary = await container.dashboardService.getSummary(FULL_OPERATOR)

      expect(summary.stats.total).toBe(before.stats.total + 1)
      expect(summary.overdue.some((item) => item.id === activeId)).toBe(true)
      expect(summary.overdue.some((item) => item.id === archivedId)).toBe(false)
      expect(summary.overdue.some((item) => item.id === deletedId)).toBe(false)
    })

    it('uses created_at fallback for domace without date_of_claim when measuring overdue age', async () => {
      const domaceId = await createDomace('DASH-DOM-FALLBACK/26', ClaimOutcome.Pending, null)
      await ctx.db
        .update(schema.domaceClaims)
        .set({ createdAt: daysAgo(365) })
        .where(eq(schema.domaceClaims.id, domaceId))

      const summary = await container.dashboardService.getSummary(FULL_OPERATOR)

      const row = summary.overdue.find((item) => item.id === domaceId)
      expect(row).toBeDefined()
      expect(row?.kind).toBe(ClaimKind.Domace)
      expect(row?.daysOpen).toBeGreaterThan(7)
    })

    it('returns stats split by kind without archived rows', async () => {
      const before = await container.dashboardService.getSummary(FULL_OPERATOR)
      await createEmotive('DASH-EM/26', ClaimOutcome.Accepted, daysAgo(2))
      await createDomace('DASH-DO/26', ClaimOutcome.Pending, daysAgo(4))
      const archivedId = await createEmotive('DASH-EM-ARCH/26')
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Archived })
        .where(eq(schema.emotiveClaims.id, archivedId))

      const summary = await container.dashboardService.getSummary(FULL_OPERATOR)

      expect(summary.stats.total).toBe(before.stats.total + 2)
      expect(summary.stats.accepted).toBe(before.stats.accepted + 1)
      expect(summary.stats.pending).toBe(before.stats.pending + 1)
      expect(summary.stats.byKind.emotive).toBe(before.stats.byKind.emotive + 1)
      expect(summary.stats.byKind.domace).toBe(before.stats.byKind.domace + 1)
      expect(summary.chart).toHaveLength(6)
    })

    it('includes newly created claims in recent list', async () => {
      const recentId = await createEmotive('DASH-RECENT/26', ClaimOutcome.Pending, daysAgo(0))

      // Recent uses created_at DESC with LIMIT 20 — pin this row so the assertion
      // does not depend on seeded or leaked claims in the shared integration DB.
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ createdAt: new Date('2099-06-01T12:00:00.000Z') })
        .where(eq(schema.emotiveClaims.id, recentId))

      const summary = await container.dashboardService.getSummary(FULL_OPERATOR)

      expect(summary.recent[0]?.id).toBe(recentId)
      expect(summary.recent.some((item) => item.mrNumber === 'DASH-RECENT/26')).toBe(true)
    })

    it('excludes archived claims from recent list', async () => {
      const archivedId = await createEmotive('DASH-REC-ARCH/26')
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Archived })
        .where(eq(schema.emotiveClaims.id, archivedId))

      const summary = await container.dashboardService.getSummary(FULL_OPERATOR)

      expect(summary.recent.some((item) => item.id === archivedId)).toBe(false)
    })

    it('returns month-over-month trends aligned with stats', async () => {
      const summary = await container.dashboardService.getSummary(FULL_OPERATOR)

      expect(summary.trends.newThisMonth.delta).toBe(
        summary.stats.newThisMonth - summary.trends.newThisMonth.previous,
      )
      expect(summary.trends.newThisMonth.previous).toBeGreaterThanOrEqual(0)
      expect(summary.trends.pending.previous).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(summary.trends.pending.delta)).toBe(true)
    })

    it('throws ForbiddenError when actor lacks list view permissions', async () => {
      await expect(
        container.dashboardService.getSummary({ id: TEST_USER_ID, permissions: [] }),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })
  })

  describe('claimDetailPath', () => {
    it('maps emotive rows to emotive detail route', () => {
      const id = '11111111-1111-4111-8111-111111111111'
      expect(claimDetailPath(ClaimKind.Emotive, id).to).toBe('/reklamacije/emotive/$id')
      expect(claimDetailPath(ClaimKind.Emotive, id).params.id).toBe(id)
    })

    it('maps domace rows to domace detail route', () => {
      const id = '66666666-6666-4666-8666-666666666666'
      expect(claimDetailPath(ClaimKind.Domace, id).to).toBe('/reklamacije/domace/$id')
      expect(claimDetailPath(ClaimKind.Domace, id).params.id).toBe(id)
    })
  })
})
