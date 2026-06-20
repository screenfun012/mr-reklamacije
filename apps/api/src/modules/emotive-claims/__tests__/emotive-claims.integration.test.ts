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

import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../../../core/errors/domain-errors.js'
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

// Admin carries the unlock key (emotive_claims.reopen) on top of operator rights.
const ADMIN_ACTOR: EmotiveClaimsActor = {
  id: TEST_USER_ID,
  permissions: [
    'emotive_claims.view',
    'emotive_claims.create',
    'emotive_claims.update',
    'emotive_claims.delete',
    'emotive_claims.change_outcome',
    'emotive_claims.reopen',
  ],
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
      'employeeId' in overrides
        ? overrides.employeeId
        : await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Dejan Milovanović'))
    const sourceId =
      'sourceId' in overrides ? overrides.sourceId : await getClaimSourceIdByCode(ctx.db, 'SELMAN')
    const warrantyReport =
      'warrantyReport' in overrides ? overrides.warrantyReport : 'Kvar na motoru pri hladnom startu'

    return {
      engineTypeId,
      dateOfClaim: new Date('2026-04-17'),
      mrNumber: '5376/26',
      employeeId,
      sourceId,
      warrantyReport,
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

    it('creates claim without warrantyReport, employeeId, or sourceId', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          warrantyReport: undefined,
          employeeId: undefined,
          sourceId: undefined,
          customerId,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.warrantyReport).toBeNull()
      expect(created.employeeId).toBeNull()
      expect(created.employeeName).toBeNull()
      expect(created.sourceId).toBeNull()
      expect(created.customerId).toBe(customerId)
    })

    it('stores engine_code when provided', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ engineCode: 'WW328394203' }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.engineCode).toBe('WW328394203')
    })

    it('returns claim without assigned employee from findById', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          employeeId: undefined,
          sourceId: undefined,
          customerId,
          mrNumber: `NO-EMP-${Date.now()}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const detail = await container.emotiveClaimsService.findById(created.id, FULL_OPERATOR)

      expect(detail.employeeId).toBeNull()
      expect(detail.employeeName).toBeNull()
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

  describe('when fetching detail', () => {
    it('resolves source, manufacturer, and per-fault reference names on the server', async () => {
      const engineTypeId = await createEngineType(`MFG-${Date.now()}`)
      await ctx.db
        .update(schema.engineTypes)
        .set({ manufacturer: 'Briggs & Stratton' })
        .where(eq(schema.engineTypes.id, engineTypeId))

      const sourceId = await getClaimSourceIdByCode(ctx.db, 'SELMAN')
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      const departmentId = await getDepartmentIdByCode(ctx.db, 'GLAVE')

      const [externalParty] = await ctx.db
        .insert(schema.externalParties)
        .values({
          kind: 'supplier',
          name: `Eksterni dobavljač ${Date.now()}`,
          isActive: true,
        })
        .returning({ id: schema.externalParties.id, name: schema.externalParties.name })

      if (externalParty === undefined) {
        throw new Error('Failed to create external party fixture')
      }

      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId,
          sourceId,
          mrNumber: `DETAIL-NAMES-${Date.now()}/26`,
          faults: [
            { faultType: FaultType.Employee, employeeId },
            { faultType: FaultType.Department, departmentId },
            { faultType: FaultType.External, externalPartyId: externalParty.id },
          ],
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const detail = await container.emotiveClaimsService.findById(created.id, FULL_OPERATOR)

      expect(detail.engineTypeManufacturer).toBe('Briggs & Stratton')
      expect(detail.sourceCode).toBe('SELMAN')
      expect(detail.sourceName).toBeTruthy()
      expect(detail.faults).toHaveLength(3)

      const employeeFault = detail.faults.find((f) => f.faultType === FaultType.Employee)
      const departmentFault = detail.faults.find((f) => f.faultType === FaultType.Department)
      const externalFault = detail.faults.find((f) => f.faultType === FaultType.External)

      expect(employeeFault?.employeeName).toBeTruthy()
      expect(departmentFault?.departmentName).toBeTruthy()
      expect(externalFault?.externalPartyName).toBe(externalParty.name)
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
      expect(bySearch.items.some((item) => item.warrantyReport?.includes('alfa'))).toBe(true)
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
      expect(firstPage.items[0]?.kind).toBe('emotive')
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

  describe('claim locking (completed claims)', () => {
    async function createCompletedClaim(): Promise<string> {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `LOCK-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )
      await container.emotiveClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Accepted },
        FULL_OPERATOR,
        auditContext,
      )
      return created.id
    }

    it('rejects field/fault edits on a completed claim with ConflictError', async () => {
      const id = await createCompletedClaim()

      await expect(
        container.emotiveClaimsService.update(
          id,
          { warrantyReport: 'pokusaj izmene' },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('rejects a faults-only replace on a completed claim with ConflictError', async () => {
      const id = await createCompletedClaim()
      const departmentId = await getDepartmentIdByCode(ctx.db, 'GLAVE')

      await expect(
        container.emotiveClaimsService.update(
          id,
          { faults: [{ faultType: FaultType.Department, departmentId }] },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('blocks a direct accepted → rejected transition with ConflictError', async () => {
      const id = await createCompletedClaim()

      await expect(
        container.emotiveClaimsService.changeOutcome(
          id,
          { outcome: ClaimOutcome.Rejected },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('forbids reopen for an operator without the reopen permission', async () => {
      const id = await createCompletedClaim()

      await expect(
        container.emotiveClaimsService.changeOutcome(
          id,
          { outcome: ClaimOutcome.Pending },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('lets an admin reopen a completed claim and audits the transition', async () => {
      const id = await createCompletedClaim()

      const reopened = await container.emotiveClaimsService.changeOutcome(
        id,
        { outcome: ClaimOutcome.Pending },
        ADMIN_ACTOR,
        auditContext,
      )

      expect(reopened.outcome).toBe(ClaimOutcome.Pending)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, id))

      const reopenAudited = auditRows.some(
        (row) =>
          row.action === AuditAction.Update &&
          (row.changes as { transition?: string } | null)?.transition === 'reopen',
      )
      expect(reopenAudited).toBe(true)
    })

    it('allows editing again once an admin has reopened the claim', async () => {
      const id = await createCompletedClaim()
      await container.emotiveClaimsService.changeOutcome(
        id,
        { outcome: ClaimOutcome.Pending },
        ADMIN_ACTOR,
        auditContext,
      )

      const updated = await container.emotiveClaimsService.update(
        id,
        { warrantyReport: 'izmena posle otkljucavanja' },
        FULL_OPERATOR,
        auditContext,
      )
      expect(updated.warrantyReport).toBe('izmena posle otkljucavanja')
    })

    it('forbids an operator from deleting a completed claim', async () => {
      const id = await createCompletedClaim()

      await expect(
        container.emotiveClaimsService.softDelete(id, FULL_OPERATOR, auditContext),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('lets an admin delete a completed claim', async () => {
      const id = await createCompletedClaim()

      await expect(
        container.emotiveClaimsService.softDelete(id, ADMIN_ACTOR, auditContext),
      ).resolves.toBeUndefined()
    })

    it('lets an operator delete a pending claim', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `DEL-PENDING-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        container.emotiveClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext),
      ).resolves.toBeUndefined()
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

    it('adds an engine code that was missing at intake and can clear it again', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ engineCode: undefined }),
        FULL_OPERATOR,
        auditContext,
      )
      expect(created.engineCode).toBeNull()

      const withCode = await container.emotiveClaimsService.update(
        created.id,
        { engineCode: 'MR-ENG-7788' },
        FULL_OPERATOR,
        auditContext,
      )
      expect(withCode.engineCode).toBe('MR-ENG-7788')

      const cleared = await container.emotiveClaimsService.update(
        created.id,
        { engineCode: null },
        FULL_OPERATOR,
        auditContext,
      )
      expect(cleared.engineCode).toBeNull()
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
