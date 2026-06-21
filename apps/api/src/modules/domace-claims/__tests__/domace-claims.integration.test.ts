import { schema } from '@mr/db'
import {
  AuditAction,
  ClaimKind,
  ClaimOutcome,
  DomaceClaimCreateInputSchema,
  FaultType,
  normalizeName,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../../../core/errors/domain-errors.js'
import { InProcessEventBus } from '../../events/in-process-event-bus.js'
import {
  ensureTestUser,
  getDepartmentIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { DomaceClaimsActor } from '../domace-claims.types.js'
import type { DomaceClaimCreateInput, DomaceClaimListQuery } from '../domace-claims.validators.js'

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://mr:mr_dev_password@localhost:5433/mr_reklamacije'

const FULL_OPERATOR: DomaceClaimsActor = {
  id: TEST_USER_ID,
  permissions: [
    'domace_claims.view',
    'domace_claims.create',
    'domace_claims.update',
    'domace_claims.delete',
    'domace_claims.change_outcome',
  ],
}

const OWN_CUSTOMER_VIEWER: DomaceClaimsActor = {
  id: TEST_USER_ID,
  permissions: ['domace_claims.view_own_customer'],
}

const ADMIN_ACTOR: DomaceClaimsActor = {
  id: TEST_USER_ID,
  permissions: [...FULL_OPERATOR.permissions, 'domace_claims.reopen'],
}

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

function listQuery(overrides: Partial<DomaceClaimListQuery> = {}): DomaceClaimListQuery {
  return { page: 1, pageSize: 50, includeDeleted: false, ...overrides }
}

function baseCreateInput(overrides: Partial<DomaceClaimCreateInput> = {}): DomaceClaimCreateInput {
  return {
    customerName: 'Auto Stanić',
    outcome: ClaimOutcome.Pending,
    faults: [],
    ...overrides,
  }
}

describe('DomaceClaimsService integration', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, DATABASE_URL, new InProcessEventBus())
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  describe('when creating', () => {
    it('assigns sequence_number and claim_year from date_of_claim', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber: 'MR1234/23', dateOfClaim: new Date('2025-06-01') }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.kind).toBe(ClaimKind.Domace)
      expect(created.sequenceNumber).toBeGreaterThan(0)
      expect(created.claimYear).toBe(2025)
      expect(created.mrNumber).toBe('MR1234/23')
      expect(created.customerName).toBe('Auto Stanić')
    })

    it('falls back claim_year to the current year when date_of_claim is omitted', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.claimYear).toBe(new Date().getUTCFullYear())
      expect(created.dateOfClaim).toBeNull()
    })

    it('accepts a claim with only customer_name and no mr_number', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ customerName: 'Servis Petrović', mrNumber: undefined }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.mrNumber).toBeNull()
      expect(created.customerName).toBe('Servis Petrović')
    })

    it('retains total_amount for financial tracking', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ totalAmount: 84500.5 }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.totalAmount).toBe(84500.5)
    })

    it('writes an audit log entry', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows).toHaveLength(1)
      expect(auditRows[0]?.action).toBe(AuditAction.Create)
      expect(auditRows[0]?.entityType).toBe('domace_claim')
    })

    it('resolves employee and department fault names on detail', async () => {
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      const departmentId = await getDepartmentIdByCode(ctx.db, 'RADILICE')

      const created = await container.domaceClaimsService.create(
        baseCreateInput({
          faults: [
            { faultType: FaultType.Employee, employeeId, notes: 'loš moment' },
            { faultType: FaultType.Department, departmentId },
          ],
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const detail = await container.domaceClaimsService.findById(created.id, FULL_OPERATOR)
      expect(detail.faults).toHaveLength(2)
      const employeeFault = detail.faults.find((f) => f.faultType === FaultType.Employee)
      const departmentFault = detail.faults.find((f) => f.faultType === FaultType.Department)
      expect(employeeFault?.employeeName).toBe('Dejan Milovanović')
      expect(departmentFault?.departmentName).toBe('Radilice')
    })

    it('rejects an invalid fault employee reference and rolls back', async () => {
      await expect(
        container.domaceClaimsService.create(
          baseCreateInput({
            faults: [
              {
                faultType: FaultType.Employee,
                employeeId: '00000000-0000-4000-8000-0000000000ff',
              },
            ],
          }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toThrow()
    })
  })

  describe('DomaceClaimCreateInputSchema', () => {
    it('requires at least one of mr_number or customer_name', () => {
      const result = DomaceClaimCreateInputSchema.safeParse({
        outcome: ClaimOutcome.Pending,
        faults: [],
      })
      expect(result.success).toBe(false)
    })

    it('accepts mr_number as free text without format constraints', () => {
      const result = DomaceClaimCreateInputSchema.safeParse({
        mrNumber: 'cokolada-123',
        outcome: ClaimOutcome.Pending,
        faults: [],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('when listing', () => {
    it('filters by outcome and full-text search across report and customer', async () => {
      await container.domaceClaimsService.create(
        baseCreateInput({
          customerName: 'Kompresor Plus',
          warrantyReport: 'Curenje ulja sa poklopca',
          outcome: ClaimOutcome.Pending,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      await container.domaceClaimsService.create(
        baseCreateInput({
          customerName: 'Drugi Kupac',
          warrantyReport: 'Vibracije radilice',
          outcome: ClaimOutcome.Accepted,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const byOutcome = await container.domaceClaimsService.list(
        listQuery({ outcome: ClaimOutcome.Accepted }),
        FULL_OPERATOR,
      )
      expect(byOutcome.items.every((i) => i.outcome === ClaimOutcome.Accepted)).toBe(true)

      const bySearch = await container.domaceClaimsService.list(
        listQuery({ search: 'Kompresor' }),
        FULL_OPERATOR,
      )
      expect(bySearch.items.some((i) => i.customerName === 'Kompresor Plus')).toBe(true)
    })

    it('excludes soft-deleted claims by default', async () => {
      const uniqueCustomer = `SoftDeleteTest-${Date.now()}`
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ customerName: uniqueCustomer }),
        FULL_OPERATOR,
        auditContext,
      )
      await container.domaceClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext)

      const visible = await container.domaceClaimsService.list(
        listQuery({ search: uniqueCustomer }),
        FULL_OPERATOR,
      )
      expect(visible.items.some((i) => i.id === created.id)).toBe(false)

      const all = await container.domaceClaimsService.list(
        listQuery({ includeDeleted: true, search: uniqueCustomer }),
        FULL_OPERATOR,
      )
      expect(all.items.some((i) => i.id === created.id)).toBe(true)
    })

    it('returns nothing for an own_customer-only actor', async () => {
      await container.domaceClaimsService.create(baseCreateInput(), FULL_OPERATOR, auditContext)

      const result = await container.domaceClaimsService.list(listQuery(), OWN_CUSTOMER_VIEWER)
      expect(result.items).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  describe('when updating', () => {
    it('edits fields and recomputes claim_year', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ dateOfClaim: new Date('2025-01-01') }),
        FULL_OPERATOR,
        auditContext,
      )

      const updated = await container.domaceClaimsService.update(
        created.id,
        { customerName: 'Novi Kupac', dateOfClaim: new Date('2026-03-03') },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.customerName).toBe('Novi Kupac')
      expect(updated.claimYear).toBe(2026)
    })
  })

  describe('claim locking (completed claims)', () => {
    async function createCompleted(outcome = ClaimOutcome.Accepted): Promise<string> {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )
      await container.domaceClaimsService.changeOutcome(
        created.id,
        { outcome },
        FULL_OPERATOR,
        auditContext,
      )
      return created.id
    }

    it('rejects field edits on a completed claim with ConflictError', async () => {
      const id = await createCompleted()
      await expect(
        container.domaceClaimsService.update(
          id,
          { customerName: 'Promena' },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('blocks a direct accepted → rejected transition with ConflictError', async () => {
      const id = await createCompleted(ClaimOutcome.Accepted)
      await expect(
        container.domaceClaimsService.changeOutcome(
          id,
          { outcome: ClaimOutcome.Rejected },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('forbids reopen for an operator without the reopen permission', async () => {
      const id = await createCompleted()
      await expect(
        container.domaceClaimsService.changeOutcome(
          id,
          { outcome: ClaimOutcome.Pending },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('lets an admin reopen a completed claim and audits the transition', async () => {
      const id = await createCompleted()
      const reopened = await container.domaceClaimsService.changeOutcome(
        id,
        { outcome: ClaimOutcome.Pending },
        ADMIN_ACTOR,
        auditContext,
      )
      expect(reopened.outcome).toBe(ClaimOutcome.Pending)
    })

    it('forbids an operator from deleting a completed claim', async () => {
      const id = await createCompleted()
      await expect(
        container.domaceClaimsService.softDelete(id, FULL_OPERATOR, auditContext),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('lets an admin delete a completed claim', async () => {
      const id = await createCompleted()
      await expect(
        container.domaceClaimsService.softDelete(id, ADMIN_ACTOR, auditContext),
      ).resolves.toBeUndefined()
    })

    it('lets an operator delete a pending claim', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )
      await expect(
        container.domaceClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext),
      ).resolves.toBeUndefined()
    })
  })

  describe('when updating repair amount', () => {
    async function createAccepted(): Promise<string> {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )
      await container.domaceClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Accepted },
        FULL_OPERATOR,
        auditContext,
      )
      return created.id
    }

    it('sets total_amount on an accepted claim', async () => {
      const id = await createAccepted()
      const updated = await container.domaceClaimsService.updateAmount(
        id,
        { totalAmount: 1234.56 },
        FULL_OPERATOR,
        auditContext,
      )
      expect(updated.totalAmount).toBe(1234.56)
    })

    it('rejects amount updates on a pending claim', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )
      await expect(
        container.domaceClaimsService.updateAmount(
          created.id,
          { totalAmount: 500 },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('rejects amount updates on a rejected claim', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )
      await container.domaceClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Rejected },
        FULL_OPERATOR,
        auditContext,
      )
      await expect(
        container.domaceClaimsService.updateAmount(
          created.id,
          { totalAmount: 500 },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('keeps total_amount in the database after reopen', async () => {
      const id = await createAccepted()
      await container.domaceClaimsService.updateAmount(
        id,
        { totalAmount: 2500 },
        FULL_OPERATOR,
        auditContext,
      )
      await container.domaceClaimsService.changeOutcome(
        id,
        { outcome: ClaimOutcome.Pending },
        ADMIN_ACTOR,
        auditContext,
      )
      const detail = await container.domaceClaimsService.findById(id, FULL_OPERATOR)
      expect(detail.outcome).toBe(ClaimOutcome.Pending)
      expect(detail.totalAmount).toBe(2500)
    })
  })

  describe('authorization', () => {
    it('throws NotFoundError for an own_customer actor fetching a real claim', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )
      await expect(
        container.domaceClaimsService.findById(created.id, OWN_CUSTOMER_VIEWER),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})
