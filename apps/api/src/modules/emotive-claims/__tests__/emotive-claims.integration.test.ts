import { schema } from '@mr/db'
import {
  AuditAction,
  ClaimEventType,
  ClaimKind,
  ClaimOutcome,
  EmotiveClaimCreateInputSchema,
  FaultType,
  normalizeName,
  type AppEvent,
} from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ValidationError } from '../../../core/errors/domain-errors.js'
import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getCustomerIdByName,
  getDepartmentIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { InProcessEventBus } from '../../events/in-process-event-bus.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { Container } from '../../../core/container.js'
import type { EmotiveClaimsActor } from '../emotive-claims.types.js'
import type {
  EmotiveClaimCreateInput,
  EmotiveClaimListQuery,
} from '../emotive-claims.validators.js'

function listQuery(overrides: Partial<EmotiveClaimListQuery> = {}): EmotiveClaimListQuery {
  return { page: 1, pageSize: 50, includeDeleted: false, ...overrides }
}

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://mr:mr_dev_password@localhost:5433/mr_reklamacije'

const FULL_OPERATOR: EmotiveClaimsActor = {
  id: TEST_USER_ID,
  permissions: [
    'emotive_claims.view',
    'emotive_claims.create',
    'emotive_claims.update',
    'emotive_claims.delete',
    'emotive_claims.change_outcome',
  ],
}

const OWN_CUSTOMER_VIEWER: EmotiveClaimsActor = {
  id: TEST_USER_ID,
  permissions: ['emotive_claims.view_own_customer'],
}

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

describe('EmotiveClaimsService integration', () => {
  let ctx: TestDbContext
  let container: Container
  let eventBus: InProcessEventBus
  let receivedEvents: AppEvent[]
  let unsubscribeEvents: (() => void) | null

  beforeEach(async () => {
    ctx = await createTestDbContext()
    eventBus = new InProcessEventBus()
    receivedEvents = []
    unsubscribeEvents = eventBus.subscribeUser(TEST_USER_ID, ['operator'], (event) => {
      receivedEvents.push(event)
    })
    container = buildTestContainer(ctx.db, ctx.pool, DATABASE_URL, eventBus)
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    unsubscribeEvents?.()
    unsubscribeEvents = null
    await ctx.cleanup()
  })

  async function createEngineType(code: string): Promise<string> {
    const created = await container.engineTypesRepository.create({ code })
    return created.id
  }

  async function buildCreateInput(
    overrides: Partial<EmotiveClaimCreateInput> = {},
  ): Promise<EmotiveClaimCreateInput> {
    const engineTypeId = overrides.engineTypeId ?? (await createEngineType(`ENG-${Date.now()}`))
    const employeeId =
      overrides.employeeId ??
      (await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Dejan Milovanović')))
    const sourceId = overrides.sourceId ?? (await getClaimSourceIdByCode(ctx.db, 'SELMAN'))

    return {
      warrantyReport: 'Kvar na motoru pri hladnom startu',
      engineTypeId,
      dateOfClaim: new Date('2026-04-17'),
      mrNumber: '5376/26',
      employeeId,
      sourceId,
      outcome: ClaimOutcome.Pending,
      faults: [],
      ...overrides,
    }
  }

  describe('when creating', () => {
    it('assigns sequence_number from database and claim_year from date_of_claim', async () => {
      const input = await buildCreateInput({ dateOfClaim: new Date('2025-06-01') })
      const created = await container.emotiveClaimsService.create(
        input,
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.sequenceNumber).toBeGreaterThan(0)
      expect(created.claimYear).toBe(2025)
      expect(created.mrNumber).toBe('5376/26')
    })

    it('stores null claim_number when omitted', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.claimNumber).toBeNull()
    })

    it('increments engine type usage_count', async () => {
      const engineTypeId = await createEngineType(`USAGE-${Date.now()}`)
      await container.emotiveClaimsService.create(
        await buildCreateInput({ engineTypeId }),
        FULL_OPERATOR,
        auditContext,
      )

      const [row] = await ctx.db
        .select({ usageCount: schema.engineTypes.usageCount })
        .from(schema.engineTypes)
        .where(eq(schema.engineTypes.id, engineTypeId))

      expect(row?.usageCount).toBe(1)
    })

    it('writes audit log and publishes claim_created on event bus', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows).toHaveLength(1)
      expect(auditRows[0]?.action).toBe(AuditAction.Create)
      expect(auditRows[0]?.entityType).toBe('emotive_claim')

      expect(receivedEvents).toEqual([
        {
          type: ClaimEventType.Created,
          payload: { kind: ClaimKind.Emotive, id: created.id },
        },
      ])
    })

    it('rolls back claim and faults when fault insert violates one_of constraint', async () => {
      const input = await buildCreateInput({
        faults: [
          {
            faultType: FaultType.Department,
            departmentId: await getDepartmentIdByCode(ctx.db, 'GLAVE'),
          },
        ],
      })

      const created = await container.emotiveClaimsService.create(
        input,
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        ctx.db.insert(schema.emotiveClaimFaults).values({
          claimId: created.id,
          faultType: FaultType.Employee,
          employeeId: null,
          departmentId: null,
          externalPartyId: null,
        }),
      ).rejects.toThrow()

      const [badFault] = await ctx.db
        .select({ id: schema.emotiveClaimFaults.id })
        .from(schema.emotiveClaimFaults)
        .where(
          and(
            eq(schema.emotiveClaimFaults.claimId, created.id),
            eq(schema.emotiveClaimFaults.faultType, FaultType.Employee),
          ),
        )

      expect(badFault).toBeUndefined()
    })

    it('rolls back entire transaction when fault references are invalid', async () => {
      const inactiveEmployeeId = crypto.randomUUID()

      await expect(
        container.emotiveClaimsService.create(
          await buildCreateInput({
            mrNumber: 'ROLLBACK-FAULT/26',
            faults: [{ faultType: FaultType.Employee, employeeId: inactiveEmployeeId }],
          }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ValidationError)

      const claims = await ctx.db
        .select()
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.mrNumber, 'ROLLBACK-FAULT/26'))
      expect(claims).toHaveLength(0)
    })
  })

  describe('EmotiveClaimCreateInputSchema', () => {
    it('rejects create input without mr_number', () => {
      const result = EmotiveClaimCreateInputSchema.safeParse({
        warrantyReport: 'test',
        engineTypeId: crypto.randomUUID(),
        dateOfClaim: '2026-01-01',
        employeeId: crypto.randomUUID(),
        sourceId: crypto.randomUUID(),
      })

      expect(result.success).toBe(false)
    })
  })

  describe('when listing', () => {
    it('filters by outcome, source, customer, date range, and full-text search', async () => {
      const sourceSelman = await getClaimSourceIdByCode(ctx.db, 'SELMAN')
      const sourceVitobello = await getClaimSourceIdByCode(ctx.db, 'VITOBELLO')
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')

      await container.emotiveClaimsService.create(
        await buildCreateInput({
          sourceId: sourceSelman,
          customerId: customerSelman,
          outcome: ClaimOutcome.Pending,
          warrantyReport: 'jedinstvena reklamacija alfa',
          dateOfClaim: new Date('2026-01-10'),
          mrNumber: '1001/26',
        }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.create(
        await buildCreateInput({
          sourceId: sourceVitobello,
          outcome: ClaimOutcome.Accepted,
          warrantyReport: 'druga reklamacija beta',
          dateOfClaim: new Date('2026-02-10'),
          mrNumber: '1002/26',
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const byOutcome = await container.emotiveClaimsService.list(
        listQuery({ outcome: ClaimOutcome.Accepted }),
        FULL_OPERATOR,
      )
      expect(byOutcome.items.every((item) => item.outcome === ClaimOutcome.Accepted)).toBe(true)
      expect(byOutcome.items.some((item) => item.mrNumber === '1002/26')).toBe(true)

      const bySource = await container.emotiveClaimsService.list(
        listQuery({ sourceId: sourceSelman }),
        FULL_OPERATOR,
      )
      expect(bySource.items.every((item) => item.sourceId === sourceSelman)).toBe(true)

      const byCustomer = await container.emotiveClaimsService.list(
        listQuery({ customerId: customerSelman }),
        FULL_OPERATOR,
      )
      expect(byCustomer.items.every((item) => item.customerId === customerSelman)).toBe(true)

      const byDate = await container.emotiveClaimsService.list(
        listQuery({
          dateFrom: new Date('2026-01-01'),
          dateTo: new Date('2026-01-31'),
        }),
        FULL_OPERATOR,
      )
      expect(byDate.items.some((item) => item.mrNumber === '1001/26')).toBe(true)
      expect(byDate.items.some((item) => item.mrNumber === '1002/26')).toBe(false)

      const bySearch = await container.emotiveClaimsService.list(
        listQuery({ search: 'alfa' }),
        FULL_OPERATOR,
      )
      expect(bySearch.items.some((item) => item.warrantyReport.includes('alfa'))).toBe(true)
    })

    it('paginates with offset ordered by date_of_claim desc', async () => {
      const [pageSource] = await ctx.db
        .insert(schema.claimSources)
        .values({
          code: `PAGE-SRC-${Date.now()}`,
          name: 'Pagination test source',
          sortOrder: 99_999,
          isActive: true,
        })
        .returning({ id: schema.claimSources.id })

      const pageSourceId = pageSource?.id
      if (pageSourceId === undefined) {
        throw new Error('Failed to create pagination test claim source')
      }

      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )

      await container.emotiveClaimsService.create(
        await buildCreateInput({
          sourceId: pageSourceId,
          customerId: customerSelman,
          dateOfClaim: new Date('2026-03-15'),
          mrNumber: '7865/25',
        }),
        FULL_OPERATOR,
        auditContext,
      )
      await container.emotiveClaimsService.create(
        await buildCreateInput({
          sourceId: pageSourceId,
          customerId: customerSelman,
          dateOfClaim: new Date('2026-01-10'),
          mrNumber: '7448/25',
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const firstPage = await container.emotiveClaimsService.list(
        listQuery({ sourceId: pageSourceId, page: 1, pageSize: 10 }),
        FULL_OPERATOR,
      )
      expect(firstPage.total).toBe(2)
      expect(firstPage.page).toBe(1)
      expect(firstPage.pageSize).toBe(10)
      expect(firstPage.items).toHaveLength(2)
      expect(firstPage.items[0]?.mrNumber).toBe('7865/25')
      expect(firstPage.items[0]?.customerName).toBe('SELMAN')
      expect(firstPage.items[0]?.employeeName).toBeTruthy()
      expect(firstPage.items[1]?.mrNumber).toBe('7448/25')

      const emptyPage = await container.emotiveClaimsService.list(
        listQuery({ sourceId: pageSourceId, page: 2, pageSize: 10 }),
        FULL_OPERATOR,
      )
      expect(emptyPage.items).toHaveLength(0)
      expect(emptyPage.total).toBe(2)

      expect(employeeId).toBeDefined()
    })

    it('excludes soft-deleted claims by default', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: 'DEL/26' }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext)

      const list = await container.emotiveClaimsService.list(listQuery(), FULL_OPERATOR)
      expect(list.items.some((item) => item.id === created.id)).toBe(false)
    })

    it('limits rows to linked customers for view_own_customer', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      const customerVitobello = await getCustomerIdByName(ctx.db, 'VITOBELLO')

      await ctx.db
        .insert(schema.customerUsers)
        .values({
          customerId: customerSelman,
          userId: TEST_USER_ID,
          assignedBy: TEST_USER_ID,
        })
        .onConflictDoNothing({
          target: [schema.customerUsers.customerId, schema.customerUsers.userId],
        })

      const linkedCustomerIds =
        await container.emotiveClaimsRepository.getUserCustomerIds(TEST_USER_ID)
      expect(linkedCustomerIds).toContain(customerSelman)

      const ownCustomerSearchToken = `view-own-customer-service-${crypto.randomUUID().slice(0, 8)}`

      const visible = await container.emotiveClaimsService.create(
        await buildCreateInput({
          customerId: customerSelman,
          mrNumber: `OWN-${crypto.randomUUID().slice(0, 8)}/26`,
          warrantyReport: `${ownCustomerSearchToken} filter test`,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.create(
        await buildCreateInput({
          customerId: customerVitobello,
          mrNumber: `OWN-OTHER-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(visible.customerId).toBe(customerSelman)

      const list = await container.emotiveClaimsService.list(
        listQuery({
          customerId: customerSelman,
          search: ownCustomerSearchToken,
          dateFrom: new Date('2026-04-17'),
          dateTo: new Date('2026-04-17'),
        }),
        OWN_CUSTOMER_VIEWER,
      )
      expect(list.items.some((item) => item.id === visible.id)).toBe(true)
      expect(list.items.every((item) => item.customerId === customerSelman)).toBe(true)
    })
  })

  describe('when updating outcome', () => {
    it('changes outcome, writes audit log, and publishes claim_updated', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )
      receivedEvents.length = 0

      const updated = await container.emotiveClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Accepted },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.outcome).toBe(ClaimOutcome.Accepted)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows.length).toBeGreaterThanOrEqual(2)
      expect(auditRows.some((row) => row.action === AuditAction.Update)).toBe(true)

      expect(receivedEvents).toContainEqual({
        type: ClaimEventType.Updated,
        payload: { kind: ClaimKind.Emotive, id: created.id },
      })
    })
  })

  describe('when updating with faults', () => {
    it('replace-all faults in a single transaction', async () => {
      const departmentId = await getDepartmentIdByCode(ctx.db, 'GLAVE')
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          faults: [{ faultType: FaultType.Department, departmentId }],
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const employeeId = await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Nikola Jović'))

      const updated = await container.emotiveClaimsService.update(
        created.id,
        {
          faults: [{ faultType: FaultType.Employee, employeeId }],
        },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.faults).toHaveLength(1)
      expect(updated.faults[0]?.faultType).toBe(FaultType.Employee)
      expect(updated.faults[0]?.employeeId).toBe(employeeId)
    })

    it('recomputes claim_year when date_of_claim changes', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ dateOfClaim: new Date('2024-05-01') }),
        FULL_OPERATOR,
        auditContext,
      )

      const updated = await container.emotiveClaimsService.update(
        created.id,
        { dateOfClaim: new Date('2026-08-01') },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.claimYear).toBe(2026)
    })
  })

  describe('sequence_number', () => {
    it('auto-increments across consecutive creates', async () => {
      const first = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: 'SEQ-1/26' }),
        FULL_OPERATOR,
        auditContext,
      )
      const second = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: 'SEQ-2/26' }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(second.sequenceNumber).toBeGreaterThan(first.sequenceNumber)
    })
  })
})
