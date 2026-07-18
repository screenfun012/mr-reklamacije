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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Container } from '../../../core/container.js'
import {
  ConflictError,
  MrKeyConflictError,
  NotFoundError,
  ValidationError,
} from '../../../core/errors/domain-errors.js'
import { InProcessEventBus } from '../../events/in-process-event-bus.js'
import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getDepartmentIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import {
  createLegacyEngineTypeWithoutManufacturer,
  createTestEngineType,
} from '../../../test-helpers/engine-type-fixtures.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { DomaceClaimsActor } from '../domace-claims.types.js'
import type { DomaceClaimCreateInput, DomaceClaimListQuery } from '../domace-claims.validators.js'

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

const RESTORE_ACTOR: DomaceClaimsActor = {
  id: TEST_USER_ID,
  permissions: [...FULL_OPERATOR.permissions, 'domace_claims.restore'],
}

// Operator scoped to its OWN customer (view_own_customer, NOT the global view) —
// used to prove the row-level gate blocks WRITES, not just reads.
const OWN_CUSTOMER_OPERATOR: DomaceClaimsActor = {
  id: TEST_USER_ID,
  permissions: [
    'domace_claims.view_own_customer',
    'domace_claims.update',
    'domace_claims.change_outcome',
    'domace_claims.restore',
    'domace_claims.delete',
  ],
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
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new InProcessEventBus())
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function createEngineManufacturer(code: string, name: string): Promise<string> {
    const created = await container.engineManufacturersRepository.create({
      code,
      name,
    })
    return created.id
  }

  async function createInactiveEngineManufacturer(code: string, name: string): Promise<string> {
    const id = await createEngineManufacturer(code, name)
    await ctx.db
      .update(schema.engineManufacturers)
      .set({ isActive: false })
      .where(eq(schema.engineManufacturers.id, id))
    return id
  }

  describe('read efficiency', () => {
    it('loads the aggregate detail exactly twice on update (service before-read + repo after-read)', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ warrantyReport: 'Originalni nalaz' }),
        FULL_OPERATOR,
        auditContext,
      )

      const findByIdSpy = vi.spyOn(container.domaceClaimsRepository, 'findById')
      await container.domaceClaimsService.update(
        created.id,
        { warrantyReport: 'Ažurirani nalaz' },
        FULL_OPERATOR,
        auditContext,
      )

      // 3 reads (service before + repo existing + repo after) collapses to 2
      // (service before + repo after); the redundant repo re-read is gone.
      expect(findByIdSpy).toHaveBeenCalledTimes(2)
      findByIdSpy.mockRestore()
    })
  })

  describe('row-level write gate for own_customer actors', () => {
    // DOMACE has no customer linkage, so an own_customer actor is denied every row.
    it('rejects update with 404 and leaves the row unchanged', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ warrantyReport: 'Originalni nalaz' }),
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        container.domaceClaimsService.update(
          created.id,
          { warrantyReport: 'PROBOJ' },
          OWN_CUSTOMER_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      const after = await container.domaceClaimsService.findById(created.id, FULL_OPERATOR)
      expect(after.warrantyReport).toBe('Originalni nalaz')
    })

    it('rejects change-outcome with 404 and leaves the outcome unchanged', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        container.domaceClaimsService.changeOutcome(
          created.id,
          { outcome: ClaimOutcome.Accepted },
          OWN_CUSTOMER_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      const after = await container.domaceClaimsService.findById(created.id, FULL_OPERATOR)
      expect(after.outcome).toBe(ClaimOutcome.Pending)
    })

    it('rejects restore with 404 and leaves it deleted', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput(),
        FULL_OPERATOR,
        auditContext,
      )
      await container.domaceClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext)

      await expect(
        container.domaceClaimsService.restore(created.id, OWN_CUSTOMER_OPERATOR, auditContext),
      ).rejects.toBeInstanceOf(NotFoundError)

      const activeList = await container.domaceClaimsService.list(listQuery(), FULL_OPERATOR)
      expect(activeList.items.some((item) => item.id === created.id)).toBe(false)
    })
  })

  describe('compare-and-swap guard (TOCTOU)', () => {
    it('refuses to update a claim soft-deleted after the before-read → ConflictError, row unchanged', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ warrantyReport: 'Originalni nalaz' }),
        FULL_OPERATOR,
        auditContext,
      )
      const before = await container.domaceClaimsRepository.findById(created.id, { type: 'all' })
      expect(before).not.toBeNull()

      // A concurrent delete commits between the service before-read and the repo UPDATE.
      await container.domaceClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext)

      await expect(
        container.domaceClaimsRepository.update(
          created.id,
          { warrantyReport: 'RACED' },
          TEST_USER_ID,
          before!,
          { type: 'all' },
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      const [raw] = await ctx.db
        .select()
        .from(schema.domaceClaims)
        .where(eq(schema.domaceClaims.id, created.id))
      expect(raw?.warrantyReport).toBe('Originalni nalaz')
    })

    it('refuses updateAmount on a claim reopened (accepted → pending) after the before-read → ConflictError', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ outcome: ClaimOutcome.Accepted }),
        FULL_OPERATOR,
        auditContext,
      )

      // Amount was editable (accepted); a concurrent reopen to pending lands first.
      await container.domaceClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Pending },
        ADMIN_ACTOR,
        auditContext,
      )

      await expect(
        container.domaceClaimsRepository.updateAmount(created.id, 1234, TEST_USER_ID, {
          type: 'all',
        }),
      ).rejects.toBeInstanceOf(ConflictError)
    })
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
      expect(await container.mrRegistryService.findByMr(null)).toBeNull()
    })

    it('registers MR key on create when mr_number is provided', async () => {
      const mrNumber = `DOM-REG-${crypto.randomUUID().slice(0, 8)}/26`
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(await container.mrRegistryService.findByMr(mrNumber)).toEqual({
        kind: ClaimKind.Domace,
        claimId: created.id,
      })
    })

    it('rejects create when MR matches an existing emotive claim', async () => {
      const mrNumber = `CROSS-${crypto.randomUUID().slice(0, 8)}/26`
      const engineTypeId = (await createTestEngineType(container, `DOM-X-${Date.now()}`)).id
      const emotive = await container.emotiveClaimsService.create(
        {
          engineTypeId,
          dateOfClaim: new Date('2026-04-17'),
          mrNumber,
          employeeId: await getEmployeeIdByNormalizedName(
            ctx.db,
            normalizeName('Dejan Milovanović'),
          ),
          sourceId: await getClaimSourceIdByCode(ctx.db, 'SELMAN'),
          outcome: ClaimOutcome.Pending,
          faults: [],
        },
        {
          id: TEST_USER_ID,
          permissions: ['emotive_claims.create'],
        },
        auditContext,
      )

      await expect(
        container.domaceClaimsService.create(
          baseCreateInput({ mrNumber: `  ${mrNumber.toUpperCase()}  ` }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toMatchObject({
        existingClaim: { kind: ClaimKind.Emotive, claimId: emotive.id },
      } satisfies Partial<MrKeyConflictError>)
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

    it('clears MR registry entry when mr_number is removed', async () => {
      const mrNumber = `DOM-CLEAR-${crypto.randomUUID().slice(0, 8)}/26`
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.domaceClaimsService.update(
        created.id,
        { mrNumber: null },
        FULL_OPERATOR,
        auditContext,
      )

      expect(await container.mrRegistryService.findByMr(mrNumber)).toBeNull()
    })
  })

  describe('when soft-deleting and restoring MR registry', () => {
    it('releases MR on soft-delete so another claim can take it (A)', async () => {
      const mrNumber = `DOM-REL-A-${crypto.randomUUID().slice(0, 8)}/26`
      const deleted = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.domaceClaimsService.softDelete(deleted.id, FULL_OPERATOR, auditContext)

      expect(await container.mrRegistryService.findByMr(mrNumber)).toBeNull()

      const replacement = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )
      expect(replacement.id).not.toBe(deleted.id)
      expect(await container.mrRegistryService.findByMr(mrNumber)).toEqual({
        kind: ClaimKind.Domace,
        claimId: replacement.id,
      })
    })

    it('restores MR registry entry when MR is free again (B)', async () => {
      const mrNumber = `DOM-REL-B-${crypto.randomUUID().slice(0, 8)}/26`
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.domaceClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext)
      expect(await container.mrRegistryService.findByMr(mrNumber)).toBeNull()

      const restored = await container.domaceClaimsService.restore(
        created.id,
        RESTORE_ACTOR,
        auditContext,
      )

      expect(restored.id).toBe(created.id)
      expect(await container.mrRegistryService.findByMr(mrNumber)).toEqual({
        kind: ClaimKind.Domace,
        claimId: created.id,
      })
    })

    it('keeps claim soft-deleted when restore fails because MR is taken (C)', async () => {
      const mrNumber = `DOM-REL-C-${crypto.randomUUID().slice(0, 8)}/26`
      const first = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )
      await container.domaceClaimsService.softDelete(first.id, FULL_OPERATOR, auditContext)

      const second = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        container.domaceClaimsService.restore(first.id, RESTORE_ACTOR, auditContext),
      ).rejects.toMatchObject({
        existingClaim: { kind: ClaimKind.Domace, claimId: second.id },
      } satisfies Partial<MrKeyConflictError>)

      const [row] = await ctx.db
        .select({ deletedAt: schema.domaceClaims.deletedAt })
        .from(schema.domaceClaims)
        .where(eq(schema.domaceClaims.id, first.id))
      expect(row?.deletedAt).not.toBeNull()
      expect(await container.mrRegistryService.findByMr(mrNumber)).toEqual({
        kind: ClaimKind.Domace,
        claimId: second.id,
      })
    })

    it('does not touch mr_registry when claim has no mr_number (D)', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ customerName: 'Servis Petrović', mrNumber: undefined }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.domaceClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext)
      expect(await container.mrRegistryService.findByMr(null)).toBeNull()

      const restored = await container.domaceClaimsService.restore(
        created.id,
        RESTORE_ACTOR,
        auditContext,
      )

      expect(restored.mrNumber).toBeNull()
      expect(await container.mrRegistryService.findByMr(null)).toBeNull()
      expect(await container.domaceClaimsService.findById(created.id, FULL_OPERATOR)).toEqual(
        restored,
      )
    })
  })

  describe('outcome_resolved_at', () => {
    it('sets outcome_resolved_at when rejecting a pending claim', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber: `DOM-RES-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      const [beforeRow] = await ctx.db
        .select({ outcomeResolvedAt: schema.domaceClaims.outcomeResolvedAt })
        .from(schema.domaceClaims)
        .where(eq(schema.domaceClaims.id, created.id))

      expect(beforeRow?.outcomeResolvedAt).toBeNull()

      await container.domaceClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Rejected },
        FULL_OPERATOR,
        auditContext,
      )

      const [afterRow] = await ctx.db
        .select({ outcomeResolvedAt: schema.domaceClaims.outcomeResolvedAt })
        .from(schema.domaceClaims)
        .where(eq(schema.domaceClaims.id, created.id))

      expect(afterRow?.outcomeResolvedAt).toBeInstanceOf(Date)
    })

    it('clears outcome_resolved_at when reopening to pending', async () => {
      const created = await container.domaceClaimsService.create(
        baseCreateInput({ mrNumber: `DOM-REOPEN-RES-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.domaceClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Accepted },
        FULL_OPERATOR,
        auditContext,
      )

      await container.domaceClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Pending },
        ADMIN_ACTOR,
        auditContext,
      )

      const [row] = await ctx.db
        .select({ outcomeResolvedAt: schema.domaceClaims.outcomeResolvedAt })
        .from(schema.domaceClaims)
        .where(eq(schema.domaceClaims.id, created.id))

      expect(row?.outcomeResolvedAt).toBeNull()
    })
  })

  describe('editing freedom (completed claims, no outcome lock)', () => {
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

    it('lets an operator edit a field on a completed claim without reopening', async () => {
      const id = await createCompleted()

      const updated = await container.domaceClaimsService.update(
        id,
        { customerName: 'Promena' },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.customerName).toBe('Promena')
    })

    it('allows internalNotes update on a completed claim', async () => {
      const id = await createCompleted()

      const updated = await container.domaceClaimsService.update(
        id,
        { internalNotes: 'Nalaz posle prihvatanja' },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.internalNotes).toBe('Nalaz posle prihvatanja')
    })

    it('lets an operator re-decide accepted → rejected directly without reopening', async () => {
      const id = await createCompleted(ClaimOutcome.Accepted)

      const updated = await container.domaceClaimsService.changeOutcome(
        id,
        { outcome: ClaimOutcome.Rejected },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.outcome).toBe(ClaimOutcome.Rejected)
    })

    it('lets an operator without reopen permission move a completed claim back to pending', async () => {
      const id = await createCompleted()

      const updated = await container.domaceClaimsService.changeOutcome(
        id,
        { outcome: ClaimOutcome.Pending },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.outcome).toBe(ClaimOutcome.Pending)
    })

    it('lets an admin reopen a completed claim', async () => {
      const id = await createCompleted()
      const reopened = await container.domaceClaimsService.changeOutcome(
        id,
        { outcome: ClaimOutcome.Pending },
        ADMIN_ACTOR,
        auditContext,
      )
      expect(reopened.outcome).toBe(ClaimOutcome.Pending)
    })

    it('lets an operator delete a completed claim without reopen permission', async () => {
      const id = await createCompleted()
      await expect(
        container.domaceClaimsService.softDelete(id, FULL_OPERATOR, auditContext),
      ).resolves.toBeUndefined()
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

  describe('when engine manufacturer is set', () => {
    it('persists manufacturer on create, resolves name on detail, and filters list', async () => {
      const manufacturerId = await createEngineManufacturer(`DOM-BMW-${Date.now()}`, 'BMW Domace')
      const otherManufacturerId = await createEngineManufacturer(
        `DOM-AUDI-${Date.now()}`,
        'Audi Domace',
      )

      const created = await container.domaceClaimsService.create(
        baseCreateInput({ manufacturerId, mrNumber: `DOM-MFG-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.manufacturerId).toBe(manufacturerId)
      expect(created.manufacturerName).toBe('BMW Domace')

      await container.domaceClaimsService.create(
        baseCreateInput({
          manufacturerId: otherManufacturerId,
          mrNumber: `DOM-MFG-OTHER-${Date.now()}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const filtered = await container.domaceClaimsService.list(
        listQuery({ manufacturerId }),
        FULL_OPERATOR,
      )
      expect(filtered.items.every((item) => item.manufacturerId === manufacturerId)).toBe(true)
    })

    it('rejects inactive engine manufacturer on create', async () => {
      const manufacturerId = await createInactiveEngineManufacturer(
        `DOM-INACTIVE-${Date.now()}`,
        'Inactive Domace',
      )

      await expect(
        container.domaceClaimsService.create(
          baseCreateInput({ manufacturerId }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('engine type and manufacturer pairing', () => {
    it('rejects create when engine type belongs to a different manufacturer', async () => {
      const bmwManufacturerId = await createEngineManufacturer(`DOM-BMW-PAIR-${Date.now()}`, 'BMW')
      const mbManufacturerId = await createEngineManufacturer(
        `DOM-MB-PAIR-${Date.now()}`,
        'Mercedes',
      )
      const bmwEngineTypeId = (
        await createTestEngineType(container, `DOM-BMW-T-${Date.now()}`, bmwManufacturerId)
      ).id

      await expect(
        container.domaceClaimsService.create(
          baseCreateInput({
            manufacturerId: mbManufacturerId,
            engineTypeId: bmwEngineTypeId,
          }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('preserves legacy engineTypeId when basic edit payload keeps orphan type', async () => {
      const legacyEngineTypeId = await createLegacyEngineTypeWithoutManufacturer(
        ctx.db,
        `DOM-LEG-${Date.now()}`,
      )

      const created = await container.domaceClaimsService.create(
        baseCreateInput({
          engineTypeId: legacyEngineTypeId,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const updated = await container.domaceClaimsService.update(
        created.id,
        {
          manufacturerId: null,
          engineTypeId: legacyEngineTypeId,
          engineCode: 'DOM-ORPHAN-KEEP',
        },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.engineTypeId).toBe(legacyEngineTypeId)
      expect(updated.engineCode).toBe('DOM-ORPHAN-KEEP')
      expect(updated.manufacturerId).toBeNull()
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
