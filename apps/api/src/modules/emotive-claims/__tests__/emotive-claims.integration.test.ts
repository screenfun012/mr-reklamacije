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
  MrKeyConflictError,
  ValidationError,
} from '../../../core/errors/domain-errors.js'
import {
  createLegacyEngineTypeWithoutManufacturer,
  createTestEngineType,
} from '../../../test-helpers/engine-type-fixtures.js'
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

const RESTORE_ACTOR: EmotiveClaimsActor = {
  id: TEST_USER_ID,
  permissions: [...FULL_OPERATOR.permissions, 'emotive_claims.restore'],
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
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    unsubscribeEvents?.()
    unsubscribeEvents = null
    await ctx.cleanup()
  })

  async function createEngineType(code: string): Promise<string> {
    const created = await createTestEngineType(container, code)
    return created.id
  }

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
      mrNumber: `TST-${crypto.randomUUID().slice(0, 8)}/26`,
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
      const input = await buildCreateInput({
        dateOfClaim: new Date('2025-06-01'),
        mrNumber: '5376/26',
      })
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

    it('registers MR key on create', async () => {
      const mrNumber = `REG-HOOK-${crypto.randomUUID().slice(0, 8)}/26`
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      const existing = await container.mrRegistryService.findByMr(mrNumber)
      expect(existing).toEqual({ kind: ClaimKind.Emotive, claimId: created.id })
    })

    it('rejects create when normalized MR is already taken', async () => {
      const mrNumber = `REG-TAKEN-${crypto.randomUUID().slice(0, 8)}/26`
      const first = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        container.emotiveClaimsService.create(
          await buildCreateInput({ mrNumber: `  ${mrNumber.toUpperCase()}  ` }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toMatchObject({
        existingClaim: { kind: ClaimKind.Emotive, claimId: first.id },
      } satisfies Partial<MrKeyConflictError>)
    })
  })

  describe('when updating mr_number', () => {
    it('moves MR registry entry when mr_number changes', async () => {
      const oldMrNumber = `REG-OLD-${crypto.randomUUID().slice(0, 8)}/26`
      const newMrNumber = `REG-NEW-${crypto.randomUUID().slice(0, 8)}/26`
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: oldMrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.update(
        created.id,
        { mrNumber: newMrNumber },
        FULL_OPERATOR,
        auditContext,
      )

      expect(await container.mrRegistryService.findByMr(oldMrNumber)).toBeNull()
      expect(await container.mrRegistryService.findByMr(newMrNumber)).toEqual({
        kind: ClaimKind.Emotive,
        claimId: created.id,
      })
    })

    it('rejects update when new MR is already taken by another claim', async () => {
      const keepMrNumber = `REG-KEEP-${crypto.randomUUID().slice(0, 8)}/26`
      const mineMrNumber = `REG-MINE-${crypto.randomUUID().slice(0, 8)}/26`
      const first = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: keepMrNumber }),
        FULL_OPERATOR,
        auditContext,
      )
      const second = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: mineMrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        container.emotiveClaimsService.update(
          second.id,
          { mrNumber: keepMrNumber },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toMatchObject({
        existingClaim: { kind: ClaimKind.Emotive, claimId: first.id },
      } satisfies Partial<MrKeyConflictError>)
    })
  })

  describe('when soft-deleting and restoring MR registry', () => {
    it('releases MR on soft-delete so another claim can take it (A)', async () => {
      const mrNumber = `REL-A-${crypto.randomUUID().slice(0, 8)}/26`
      const deleted = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.softDelete(deleted.id, FULL_OPERATOR, auditContext)

      expect(await container.mrRegistryService.findByMr(mrNumber)).toBeNull()

      const replacement = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )
      expect(replacement.id).not.toBe(deleted.id)
      expect(await container.mrRegistryService.findByMr(mrNumber)).toEqual({
        kind: ClaimKind.Emotive,
        claimId: replacement.id,
      })
    })

    it('restores MR registry entry when MR is free again (B)', async () => {
      const mrNumber = `REL-B-${crypto.randomUUID().slice(0, 8)}/26`
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext)
      expect(await container.mrRegistryService.findByMr(mrNumber)).toBeNull()

      const restored = await container.emotiveClaimsService.restore(
        created.id,
        RESTORE_ACTOR,
        auditContext,
      )

      expect(restored.id).toBe(created.id)
      expect(await container.mrRegistryService.findByMr(mrNumber)).toEqual({
        kind: ClaimKind.Emotive,
        claimId: created.id,
      })
    })

    it('keeps claim soft-deleted when restore fails because MR is taken (C)', async () => {
      const mrNumber = `REL-C-${crypto.randomUUID().slice(0, 8)}/26`
      const first = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )
      await container.emotiveClaimsService.softDelete(first.id, FULL_OPERATOR, auditContext)

      const second = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        container.emotiveClaimsService.restore(first.id, RESTORE_ACTOR, auditContext),
      ).rejects.toMatchObject({
        existingClaim: { kind: ClaimKind.Emotive, claimId: second.id },
      } satisfies Partial<MrKeyConflictError>)

      const [row] = await ctx.db
        .select({ deletedAt: schema.emotiveClaims.deletedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, first.id))
      expect(row?.deletedAt).not.toBeNull()
      expect(await container.mrRegistryService.findByMr(mrNumber)).toEqual({
        kind: ClaimKind.Emotive,
        claimId: second.id,
      })
    })

    it('writes audit log with restore action', async () => {
      const mrNumber = `REL-AUDIT-${crypto.randomUUID().slice(0, 8)}/26`
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber }),
        FULL_OPERATOR,
        auditContext,
      )
      await container.emotiveClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext)

      await container.emotiveClaimsService.restore(created.id, RESTORE_ACTOR, auditContext)

      const [entry] = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.entityType, 'emotive_claim'),
            eq(schema.auditLog.entityId, created.id),
            eq(schema.auditLog.action, AuditAction.Restore),
          ),
        )
      expect(entry).toBeDefined()
    })
  })

  describe('when fetching detail', () => {
    it('resolves source, manufacturer, and per-fault reference names on the server', async () => {
      const engineTypeId = await createEngineType(`MFG-${Date.now()}`)
      const briggsManufacturerId = await createEngineManufacturer(
        `BRIGGS-${Date.now()}`,
        'Briggs & Stratton',
      )
      await ctx.db
        .update(schema.engineTypes)
        .set({ manufacturerId: briggsManufacturerId })
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

  describe('when engine manufacturer is set', () => {
    it('persists manufacturer on create, resolves name on detail, filters list, and clears on update', async () => {
      const manufacturerId = await createEngineManufacturer(`BMW-${Date.now()}`, 'BMW Test')
      const otherManufacturerId = await createEngineManufacturer(`AUDI-${Date.now()}`, 'Audi Test')
      const bmwEngineTypeId = (
        await createTestEngineType(container, `BMW-ET-${Date.now()}`, manufacturerId)
      ).id
      const audiEngineTypeId = (
        await createTestEngineType(container, `AUDI-ET-${Date.now()}`, otherManufacturerId)
      ).id
      const mrWithManufacturer = `MFG-${Date.now()}/26`
      const mrOther = `MFG-OTHER-${Date.now()}/26`

      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          manufacturerId,
          engineTypeId: bmwEngineTypeId,
          mrNumber: mrWithManufacturer,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.manufacturerId).toBe(manufacturerId)
      expect(created.manufacturerName).toBe('BMW Test')

      await container.emotiveClaimsService.create(
        await buildCreateInput({
          manufacturerId: otherManufacturerId,
          engineTypeId: audiEngineTypeId,
          mrNumber: mrOther,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const filtered = await container.emotiveClaimsService.list(
        listQuery({ manufacturerId }),
        FULL_OPERATOR,
      )
      expect(filtered.items.every((item) => item.manufacturerId === manufacturerId)).toBe(true)
      expect(filtered.items.some((item) => item.mrNumber === mrWithManufacturer)).toBe(true)
      expect(filtered.items.some((item) => item.mrNumber === mrOther)).toBe(false)

      const updated = await container.emotiveClaimsService.update(
        created.id,
        { manufacturerId: null },
        FULL_OPERATOR,
        auditContext,
      )
      expect(updated.manufacturerId).toBeNull()
      expect(updated.manufacturerName).toBeNull()
    })

    it('rejects inactive engine manufacturer on create', async () => {
      const manufacturerId = await createInactiveEngineManufacturer(
        `INACTIVE-${Date.now()}`,
        'Inactive Mfg',
      )

      await expect(
        container.emotiveClaimsService.create(
          await buildCreateInput({ manufacturerId }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('engine type and manufacturer pairing', () => {
    it('rejects create when engine type belongs to a different manufacturer', async () => {
      const bmwManufacturerId = await createEngineManufacturer(`BMW-PAIR-${Date.now()}`, 'BMW')
      const mbManufacturerId = await createEngineManufacturer(`MB-PAIR-${Date.now()}`, 'Mercedes')
      const bmwEngineTypeId = (
        await createTestEngineType(container, `BMW-T-${Date.now()}`, bmwManufacturerId)
      ).id

      await expect(
        container.emotiveClaimsService.create(
          await buildCreateInput({
            manufacturerId: mbManufacturerId,
            engineTypeId: bmwEngineTypeId,
          }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('allows legacy orphan engine type without claim manufacturer', async () => {
      const legacyEngineTypeId = await createLegacyEngineTypeWithoutManufacturer(
        ctx.db,
        `LEG-${Date.now()}`,
      )

      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: legacyEngineTypeId,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.engineTypeId).toBe(legacyEngineTypeId)
      expect(created.manufacturerId).toBeNull()
    })

    it('preserves legacy engineTypeId when basic edit payload keeps orphan type', async () => {
      const legacyEngineTypeId = await createLegacyEngineTypeWithoutManufacturer(
        ctx.db,
        `LEG-UPD-${Date.now()}`,
      )

      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: legacyEngineTypeId,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const updated = await container.emotiveClaimsService.update(
        created.id,
        {
          manufacturerId: null,
          engineTypeId: legacyEngineTypeId,
          engineCode: 'ORPHAN-KEEP',
        },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.engineTypeId).toBe(legacyEngineTypeId)
      expect(updated.engineCode).toBe('ORPHAN-KEEP')
      expect(updated.manufacturerId).toBeNull()
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
      const mrPending = `LIST-P-${crypto.randomUUID().slice(0, 8)}/26`
      const mrAccepted = `LIST-A-${crypto.randomUUID().slice(0, 8)}/26`

      await container.emotiveClaimsService.create(
        await buildCreateInput({
          sourceId: sourceSelman,
          customerId: customerSelman,
          outcome: ClaimOutcome.Pending,
          warrantyReport: 'jedinstvena reklamacija alfa',
          dateOfClaim: new Date('2026-01-10'),
          mrNumber: mrPending,
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
          mrNumber: mrAccepted,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const byOutcome = await container.emotiveClaimsService.list(
        listQuery({ outcome: ClaimOutcome.Accepted, search: 'druga reklamacija beta' }),
        FULL_OPERATOR,
      )
      expect(byOutcome.items.every((item) => item.outcome === ClaimOutcome.Accepted)).toBe(true)
      expect(byOutcome.items.some((item) => item.mrNumber === mrAccepted)).toBe(true)

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
      expect(byDate.items.some((item) => item.mrNumber === mrPending)).toBe(true)
      expect(byDate.items.some((item) => item.mrNumber === mrAccepted)).toBe(false)

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
      const mrNewer = `PAGE-NEW-${crypto.randomUUID().slice(0, 8)}/26`
      const mrOlder = `PAGE-OLD-${crypto.randomUUID().slice(0, 8)}/26`

      await container.emotiveClaimsService.create(
        await buildCreateInput({
          sourceId: pageSourceId,
          customerId: customerSelman,
          dateOfClaim: new Date('2026-03-15'),
          mrNumber: mrNewer,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      await container.emotiveClaimsService.create(
        await buildCreateInput({
          sourceId: pageSourceId,
          customerId: customerSelman,
          dateOfClaim: new Date('2026-01-10'),
          mrNumber: mrOlder,
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
      expect(firstPage.items[0]?.mrNumber).toBe(mrNewer)
      expect(firstPage.items[0]?.customerName).toBe('SELMAN')
      expect(firstPage.items[0]?.employeeName).toBeTruthy()
      expect(firstPage.items[1]?.mrNumber).toBe(mrOlder)

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

    it('sets outcome_resolved_at when accepting a pending claim', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `RESOLVED-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      const [beforeRow] = await ctx.db
        .select({ outcomeResolvedAt: schema.emotiveClaims.outcomeResolvedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, created.id))

      expect(beforeRow?.outcomeResolvedAt).toBeNull()

      await container.emotiveClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Accepted },
        FULL_OPERATOR,
        auditContext,
      )

      const [afterRow] = await ctx.db
        .select({ outcomeResolvedAt: schema.emotiveClaims.outcomeResolvedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, created.id))

      expect(afterRow?.outcomeResolvedAt).toBeInstanceOf(Date)
    })

    it('clears outcome_resolved_at when reopening to pending', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `REOPEN-RES-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Rejected },
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Pending },
        ADMIN_ACTOR,
        auditContext,
      )

      const [row] = await ctx.db
        .select({ outcomeResolvedAt: schema.emotiveClaims.outcomeResolvedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, created.id))

      expect(row?.outcomeResolvedAt).toBeNull()
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

    it('allows internalNotes update on a completed claim', async () => {
      const id = await createCompletedClaim()

      const updated = await container.emotiveClaimsService.update(
        id,
        { internalNotes: 'Nalaz posle prihvatanja' },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.internalNotes).toBe('Nalaz posle prihvatanja')
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
