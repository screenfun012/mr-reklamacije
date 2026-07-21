import { schema } from '@mr/db'
import {
  ClaimKind,
  ClaimOutcome,
  ClientClaimPhase,
  claimDetailPath,
  normalizeName,
  SYSTEM_ROLE_CLIENT,
} from '@mr/shared'
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
import { createTestEngineType } from '../../../test-helpers/engine-type-fixtures.js'
import {
  buildTestContainer,
  createDashboardTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
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
    const engineType = await createTestEngineType(container, `ENG-${Date.now()}-${mrNumber}`)
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
        findings: [],
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
        findings: [],
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

    it('rejects own-customer-only actors — the internal summary is GLOBAL data', async () => {
      // Regression: a portal client (view_own_customer) must never read the
      // internal dashboard (other customers' names/MR numbers leak through it).
      await expect(
        container.dashboardService.getSummary({
          id: TEST_USER_ID,
          permissions: ['emotive_claims.view_own_customer', 'domace_claims.view_own_customer'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })
  })

  describe('client portal summary (/api/dashboard/client-summary)', () => {
    // Shared integration DB: every test uses its OWN client user + fresh
    // customer so counts are exact regardless of other suites/runs.
    const CLIENT_PERMS = [
      'emotive_claims.view_own_customer',
      'domace_claims.view_own_customer',
    ] as const

    function uniqueMr(prefix: string): string {
      return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}/26`
    }

    async function createLinkedCustomer(userId: string): Promise<string> {
      const [customer] = await ctx.db
        .insert(schema.customers)
        .values({
          kind: 'emotive_partner',
          name: `DASH-CLIENT-${userId.slice(0, 8)}-${Date.now()}`,
        })
        .returning({ id: schema.customers.id })
      if (customer === undefined) {
        throw new Error('failed to insert test customer')
      }
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customer.id, userId, assignedBy: TEST_USER_ID })
        .onConflictDoNothing()
      return customer.id
    }

    async function createEmotiveForCustomer(
      mrNumber: string,
      customerId: string,
      employee: 'with_employee' | 'no_employee' = 'no_employee',
    ): Promise<string> {
      const engineType = await createTestEngineType(container, `ENG-CS-${Date.now()}-${mrNumber}`)
      const created = await container.emotiveClaimsService.create(
        {
          engineTypeId: engineType.id,
          dateOfClaim: daysAgo(3),
          mrNumber,
          outcome: ClaimOutcome.Pending,
          warrantyReport: 'Client summary test claim',
          customerId,
          sourceId: await getClaimSourceIdByCode(ctx.db, 'SELMAN'),
          faults: [],
          findings: [],
          ...(employee === 'with_employee'
            ? {
                employeeId: await getEmployeeIdByNormalizedName(
                  ctx.db,
                  normalizeName('Dejan Milovanović'),
                ),
              }
            : {}),
        },
        {
          id: TEST_USER_ID,
          permissions: ['emotive_claims.view', 'emotive_claims.create', 'domace_claims.view'],
        },
        auditContext,
      )
      return created.id
    }

    it('returns phase counts and a derived activity feed scoped to the linked customer', async () => {
      const clientUserId = '99999999-9999-4999-8999-999999999999'
      await ensureTestUser(ctx.db, clientUserId)
      const myCustomer = await createLinkedCustomer(clientUserId)
      const otherCustomer = await createLinkedCustomer(TEST_USER_ID)

      const otherMr = uniqueMr('CS-OTHER')
      const receivedId = await createEmotiveForCustomer(uniqueMr('CS-REC'), myCustomer)
      const progressId = await createEmotiveForCustomer(
        uniqueMr('CS-PROG'),
        myCustomer,
        'with_employee',
      )
      const resolvedId = await createEmotiveForCustomer(
        uniqueMr('CS-DONE'),
        myCustomer,
        'with_employee',
      )
      await container.emotiveClaimsService.changeOutcome(
        resolvedId,
        { outcome: ClaimOutcome.Accepted },
        {
          id: TEST_USER_ID,
          permissions: ['emotive_claims.view', 'emotive_claims.change_outcome'],
        },
        auditContext,
      )
      // Gate B: a decided claim only counts/shows as resolved once published.
      await container.emotiveClaimsService.publish(resolvedId, auditContext)
      // Another customer's claim must be invisible in stats AND activity.
      await createEmotiveForCustomer(otherMr, otherCustomer, 'with_employee')

      const summary = await container.dashboardService.getClientSummary({
        id: clientUserId,
        permissions: [...CLIENT_PERMS],
      })

      // 2026-07-04 rule: received = everything taken in, inProgress = every
      // pending claim (handler assignment no longer splits the phases).
      expect(summary.stats).toEqual({ received: 3, inProgress: 2, resolved: 1, total: 3 })

      const eventsFor = (id: string) =>
        summary.activity.filter((item) => item.claimId === id).map((item) => item.event)
      expect(eventsFor(receivedId)).toContain(ClientClaimPhase.Received)
      expect(eventsFor(progressId)).toContain(ClientClaimPhase.Received)
      expect(eventsFor(resolvedId)).toContain(ClientClaimPhase.Outcome)
      const outcomeEvent = summary.activity.find(
        (item) => item.claimId === resolvedId && item.event === ClientClaimPhase.Outcome,
      )
      expect(outcomeEvent?.outcome).toBe(ClaimOutcome.Accepted)
      expect(summary.activity.some((item) => item.mrNumber === otherMr)).toBe(false)

      // The projection must carry NO audit internals or claim internals.
      const serialized = JSON.stringify(summary)
      for (const forbidden of ['before', 'after', 'actorIp', 'actorUserAgent', 'changes']) {
        expect(serialized).not.toContain(`"${forbidden}"`)
      }
    })

    it('honors claim visibility (Gate B): a decided-but-unpublished claim reads in-progress, not resolved, until published', async () => {
      const clientUserId = '55555555-5555-4555-8555-555555555554'
      await ensureTestUser(ctx.db, clientUserId)
      const myCustomer = await createLinkedCustomer(clientUserId)

      const pendingId = await createEmotiveForCustomer(uniqueMr('CS-PENDING'), myCustomer)
      const decidedId = await createEmotiveForCustomer(
        uniqueMr('CS-PRIVATE'),
        myCustomer,
        'with_employee',
      )
      await container.emotiveClaimsService.changeOutcome(
        decidedId,
        { outcome: ClaimOutcome.Accepted },
        {
          id: TEST_USER_ID,
          permissions: ['emotive_claims.view', 'emotive_claims.change_outcome'],
        },
        auditContext,
      )

      const beforePublish = await container.dashboardService.getClientSummary({
        id: clientUserId,
        permissions: [...CLIENT_PERMS],
      })
      // Guard: the still-pending claim is unaffected by visibility gating.
      expect(beforePublish.stats).toEqual({ received: 2, inProgress: 2, resolved: 0, total: 2 })
      expect(
        beforePublish.activity.some(
          (item) => item.claimId === decidedId && item.event === ClientClaimPhase.Outcome,
        ),
      ).toBe(false)

      await container.emotiveClaimsService.publish(decidedId, auditContext)

      const afterPublish = await container.dashboardService.getClientSummary({
        id: clientUserId,
        permissions: [...CLIENT_PERMS],
      })
      expect(afterPublish.stats).toEqual({ received: 2, inProgress: 1, resolved: 1, total: 2 })
      const outcomeEvent = afterPublish.activity.find(
        (item) => item.claimId === decidedId && item.event === ClientClaimPhase.Outcome,
      )
      expect(outcomeEvent?.outcome).toBe(ClaimOutcome.Accepted)
      // Guard: the still-pending claim still never emits an Outcome event.
      expect(
        afterPublish.activity.some(
          (item) => item.claimId === pendingId && item.event === ClientClaimPhase.Outcome,
        ),
      ).toBe(false)
    })

    it('derives an in-progress event when a handler is assigned to a pending claim', async () => {
      const clientUserId = '77777777-7777-4777-8777-777777777776'
      await ensureTestUser(ctx.db, clientUserId)
      const myCustomer = await createLinkedCustomer(clientUserId)
      const claimId = await createEmotiveForCustomer(uniqueMr('CS-ASSIGN'), myCustomer)

      await container.emotiveClaimsService.update(
        claimId,
        {
          employeeId: await getEmployeeIdByNormalizedName(
            ctx.db,
            normalizeName('Dejan Milovanović'),
          ),
        },
        { id: TEST_USER_ID, permissions: ['emotive_claims.view', 'emotive_claims.update'] },
        auditContext,
      )

      const summary = await container.dashboardService.getClientSummary({
        id: clientUserId,
        permissions: [...CLIENT_PERMS],
      })

      expect(summary.stats.inProgress).toBe(1)
      expect(
        summary.activity.some(
          (item) => item.claimId === claimId && item.event === ClientClaimPhase.InProgress,
        ),
      ).toBe(true)
    })

    it('returns zeroed stats and empty activity for a client with no linked customers', async () => {
      const UNLINKED_USER_ID = '88888888-8888-4888-8888-888888888887'
      await ensureTestUser(ctx.db, UNLINKED_USER_ID)

      const summary = await container.dashboardService.getClientSummary({
        id: UNLINKED_USER_ID,
        permissions: [...CLIENT_PERMS],
      })

      expect(summary.stats).toEqual({ received: 0, inProgress: 0, resolved: 0, total: 0 })
      expect(summary.activity).toEqual([])
    })

    it('gates the routes: client passes /client-summary but NOT the internal /summary', async () => {
      const clientUserId = '66666666-6666-4666-8666-666666666665'
      await ensureTestUser(ctx.db, clientUserId)
      const app = createDashboardTestApp(
        container,
        testUser([...CLIENT_PERMS], clientUserId, [SYSTEM_ROLE_CLIENT]),
      )

      const clientSummaryRes = await app.request('/api/dashboard/client-summary')
      expect(clientSummaryRes.status).toBe(200)

      const internalSummaryRes = await app.request('/api/dashboard/summary')
      expect(internalSummaryRes.status).toBe(403)
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
