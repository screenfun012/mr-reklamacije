import { schema } from '@mr/db'
import {
  AuditAction,
  ClaimEventType,
  ClaimKind,
  ClaimOutcome,
  EmotiveClaimCreateInputSchema,
  EmotiveClaimUpdateInputSchema,
  FaultType,
  normalizeName,
  type AppEvent,
} from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ConflictError,
  MrKeyConflictError,
  NotFoundError,
  ValidationError,
} from '../../../core/errors/domain-errors.js'
import {
  createLegacyEngineTypeWithoutManufacturer,
  createTestEngineType,
} from '../../../test-helpers/engine-type-fixtures.js'
import {
  ensureTestUser,
  getClaimCategoryIdByCode,
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

const ADMIN_ACTOR: EmotiveClaimsActor = {
  id: TEST_USER_ID,
  permissions: [...FULL_OPERATOR.permissions],
}

const RESTORE_ACTOR: EmotiveClaimsActor = {
  id: TEST_USER_ID,
  permissions: [...FULL_OPERATOR.permissions, 'emotive_claims.restore'],
}

// Operator scoped to its OWN customer (view_own_customer, NOT the global view) —
// used to prove the row-level gate blocks WRITES, not just reads.
const OWN_CUSTOMER_OPERATOR: EmotiveClaimsActor = {
  id: TEST_USER_ID,
  permissions: [
    'emotive_claims.view_own_customer',
    'emotive_claims.update',
    'emotive_claims.change_outcome',
    'emotive_claims.restore',
    'emotive_claims.delete',
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
  // Every `.update(...)` call below now MUST carry categoryId (spec §3.3 — required on update
  // too, so an edit can never leave a claim uncategorised). Resolved once per test from the
  // migration-seeded catalog row; tests that care about the category use their own value instead.
  let defaultCategoryId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    eventBus = new InProcessEventBus()
    receivedEvents = []
    unsubscribeEvents = eventBus.subscribeUser(TEST_USER_ID, ['operator'], (event) => {
      receivedEvents.push(event)
    })
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
    await ensureTestUser(ctx.db)
    defaultCategoryId = await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA')
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
    const categoryId =
      overrides.categoryId ?? (await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA'))

    return {
      engineTypeId,
      categoryId,
      dateOfClaim: new Date('2026-04-17'),
      mrNumber: `TST-${crypto.randomUUID().slice(0, 8)}/26`,
      employeeId,
      sourceId,
      warrantyReport,
      outcome: ClaimOutcome.Pending,
      faults: [],
      findings: [],
      ...overrides,
    }
  }

  describe('read efficiency', () => {
    it('loads the aggregate detail exactly twice on update (service before-read + repo after-read)', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `EFF-${crypto.randomUUID().slice(0, 8)}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      const findByIdSpy = vi.spyOn(container.emotiveClaimsRepository, 'findById')
      await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, warrantyReport: 'Ažurirani nalaz' },
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
    // Links the acting user to SELMAN but creates the claim under VITOBELLO — a
    // customer the user is NOT linked to (i.e. "another company's claim").
    async function createForeignClaim(): Promise<string> {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customerSelman, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing({
          target: [schema.customerUsers.customerId, schema.customerUsers.userId],
        })

      const customerVitobello = await getCustomerIdByName(ctx.db, 'VITOBELLO')
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          customerId: customerVitobello,
          mrNumber: `GATE-${crypto.randomUUID().slice(0, 8)}/26`,
          warrantyReport: 'Originalni nalaz',
        }),
        FULL_OPERATOR,
        auditContext,
      )
      return created.id
    }

    it('rejects update of another customer’s claim with 404 and leaves the row unchanged', async () => {
      const id = await createForeignClaim()

      await expect(
        container.emotiveClaimsService.update(
          id,
          { categoryId: defaultCategoryId, warrantyReport: 'PROBOJ' },
          OWN_CUSTOMER_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      const after = await container.emotiveClaimsService.findById(id, FULL_OPERATOR)
      expect(after.warrantyReport).toBe('Originalni nalaz')
    })

    it('rejects change-outcome of another customer’s claim with 404 and leaves the outcome unchanged', async () => {
      const id = await createForeignClaim()

      await expect(
        container.emotiveClaimsService.changeOutcome(
          id,
          { outcome: ClaimOutcome.Accepted },
          OWN_CUSTOMER_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      const after = await container.emotiveClaimsService.findById(id, FULL_OPERATOR)
      expect(after.outcome).toBe(ClaimOutcome.Pending)
    })

    it('rejects restore of another customer’s deleted claim with 404 and leaves it deleted', async () => {
      const id = await createForeignClaim()
      await container.emotiveClaimsService.softDelete(id, FULL_OPERATOR, auditContext)

      await expect(
        container.emotiveClaimsService.restore(id, OWN_CUSTOMER_OPERATOR, auditContext),
      ).rejects.toBeInstanceOf(NotFoundError)

      const activeList = await container.emotiveClaimsService.list(listQuery(), FULL_OPERATOR)
      expect(activeList.items.some((item) => item.id === id)).toBe(false)
    })
  })

  describe('client detail-access gate for Primljeno (private) claims', () => {
    async function linkUserToCustomer(customerId: string): Promise<void> {
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing({
          target: [schema.customerUsers.customerId, schema.customerUsers.userId],
        })
    }

    async function createClaimForCustomer(customerId: string): Promise<string> {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          customerId,
          mrNumber: `PRIML-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      return created.id
    }

    it('404s a client on a claim with no clientVisibleAt/publishedAt (Primljeno)', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createClaimForCustomer(customerId)

      await expect(
        container.emotiveClaimsService.findById(id, OWN_CUSTOMER_VIEWER),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('returns the claim to a client once client_visible_at is set', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createClaimForCustomer(customerId)

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientVisibleAt: new Date() })
        .where(eq(schema.emotiveClaims.id, id))

      const found = await container.emotiveClaimsService.findById(id, OWN_CUSTOMER_VIEWER)
      expect(found.id).toBe(id)
    })

    it('returns the claim to a client once published_at is set', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createClaimForCustomer(customerId)

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ publishedAt: new Date() })
        .where(eq(schema.emotiveClaims.id, id))

      const found = await container.emotiveClaimsService.findById(id, OWN_CUSTOMER_VIEWER)
      expect(found.id).toBe(id)
    })

    it('always returns a Primljeno claim to a full-view operator', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      const id = await createClaimForCustomer(customerId)

      const found = await container.emotiveClaimsService.findById(id, FULL_OPERATOR)
      expect(found.id).toBe(id)
      expect(found.clientVisibleAt).toBeNull()
      expect(found.publishedAt).toBeNull()
    })

    it('keeps the Primljeno claim in the client LIST (list is not filtered)', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createClaimForCustomer(customerId)

      const list = await container.emotiveClaimsService.list(
        listQuery({ customerId }),
        OWN_CUSTOMER_VIEWER,
      )
      expect(list.items.some((item) => item.id === id)).toBe(true)
    })
  })

  describe('client view tracking (Task 1 — detail GET is read-only; markClientSeen records the view)', () => {
    async function linkUserToCustomer(customerId: string, userId = TEST_USER_ID): Promise<void> {
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId, userId, assignedBy: TEST_USER_ID })
        .onConflictDoNothing({
          target: [schema.customerUsers.customerId, schema.customerUsers.userId],
        })
    }

    // Openable: both client-visibility gates (clientVisibleAt + publishedAt) are set,
    // so a client actor's findById/markClientSeen passes the Phase-2 Primljeno gate.
    async function createOpenableClaim(customerId: string, mrPrefix: string): Promise<string> {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          customerId,
          mrNumber: `${mrPrefix}-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientVisibleAt: new Date(), publishedAt: new Date() })
        .where(eq(schema.emotiveClaims.id, created.id))
      return created.id
    }

    async function getView(claimId: string, userId: string): Promise<Date | null> {
      const [row] = await ctx.db
        .select({ viewedAt: schema.emotiveClaimClientViews.viewedAt })
        .from(schema.emotiveClaimClientViews)
        .where(
          and(
            eq(schema.emotiveClaimClientViews.emotiveClaimId, claimId),
            eq(schema.emotiveClaimClientViews.userId, userId),
          ),
        )
      return row?.viewedAt ?? null
    }

    it('findById does NOT create a view row for a client (pure read)', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createOpenableClaim(customerId, 'VIEW1')

      await container.emotiveClaimsService.findById(id, OWN_CUSTOMER_VIEWER)

      const viewedAt = await getView(id, TEST_USER_ID)
      expect(viewedAt).toBeNull()
    })

    it('markClientSeen upserts a view row with viewedAt ≈ now for own_customer', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createOpenableClaim(customerId, 'VIEW2')

      const before = Date.now()
      await container.emotiveClaimsService.markClientSeen(id, OWN_CUSTOMER_VIEWER)
      const after = Date.now()

      const viewedAt = await getView(id, TEST_USER_ID)
      expect(viewedAt).not.toBeNull()
      expect(viewedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000)
      expect(viewedAt!.getTime()).toBeLessThanOrEqual(after + 1000)
    })

    it('markClientSeen advances viewedAt on a second call (upsert — no duplicate-key crash)', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createOpenableClaim(customerId, 'VIEW3')

      await container.emotiveClaimsService.markClientSeen(id, OWN_CUSTOMER_VIEWER)
      const firstViewedAt = await getView(id, TEST_USER_ID)
      expect(firstViewedAt).not.toBeNull()

      await new Promise((resolve) => setTimeout(resolve, 5))
      await container.emotiveClaimsService.markClientSeen(id, OWN_CUSTOMER_VIEWER)
      const secondViewedAt = await getView(id, TEST_USER_ID)

      expect(secondViewedAt).not.toBeNull()
      expect(secondViewedAt!.getTime()).toBeGreaterThanOrEqual(firstViewedAt!.getTime())
    })

    it('markClientSeen does NOT create a view row for a full-view internal actor (no-op)', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      const id = await createOpenableClaim(customerId, 'VIEW4')

      await container.emotiveClaimsService.markClientSeen(id, FULL_OPERATOR)

      const viewedAt = await getView(id, TEST_USER_ID)
      expect(viewedAt).toBeNull()
    })

    it('markClientSeen 404s on a Primljeno claim (both gates null)', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          customerId,
          mrNumber: `VIEW5-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        container.emotiveClaimsService.markClientSeen(created.id, OWN_CUSTOMER_VIEWER),
      ).rejects.toBeInstanceOf(NotFoundError)

      const viewedAt = await getView(created.id, TEST_USER_ID)
      expect(viewedAt).toBeNull()
    })

    it('markClientSeen 404s on another company’s claim (no cross-company leak)', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerSelman)
      const customerVitobello = await getCustomerIdByName(ctx.db, 'VITOBELLO')
      const id = await createOpenableClaim(customerVitobello, 'VIEW6')

      await expect(
        container.emotiveClaimsService.markClientSeen(id, OWN_CUSTOMER_VIEWER),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('end-to-end: findById shows freshness and does NOT clear it; markClientSeen then clears it', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createOpenableClaim(customerId, 'VIEW7')
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientContentUpdatedAt: new Date() })
        .where(eq(schema.emotiveClaims.id, id))

      const clientActor = {
        id: TEST_USER_ID,
        permissions: ['emotive_claims.view_own_customer', 'domace_claims.view_own_customer'],
      }
      const unifiedListQuery = { page: 1, pageSize: 50 as const, includeDeleted: false, customerId }

      const before = await container.claimsService.list(unifiedListQuery, clientActor)
      const beforeItem = before.items.find((item) => item.id === id)
      expect(beforeItem?.kind === 'emotive' ? beforeItem.freshness : null).toBe('update')

      // Reading the detail (possibly multiple times) must NOT clear the badge.
      await container.emotiveClaimsService.findById(id, OWN_CUSTOMER_VIEWER)
      await container.emotiveClaimsService.findById(id, OWN_CUSTOMER_VIEWER)

      const afterRead = await container.claimsService.list(unifiedListQuery, clientActor)
      const afterReadItem = afterRead.items.find((item) => item.id === id)
      expect(afterReadItem?.kind === 'emotive' ? afterReadItem.freshness : null).toBe('update')

      // Only the explicit mark-seen call clears it.
      await container.emotiveClaimsService.markClientSeen(id, OWN_CUSTOMER_VIEWER)

      const after = await container.claimsService.list(unifiedListQuery, clientActor)
      const afterItem = after.items.find((item) => item.id === id)
      expect(afterItem?.kind === 'emotive' ? afterItem.freshness : null).toBeNull()
    })
  })

  describe('sectionFreshness (Task 3 — per-section NEW/UPDATE markers on the client detail)', () => {
    async function linkUserToCustomer(customerId: string, userId = TEST_USER_ID): Promise<void> {
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId, userId, assignedBy: TEST_USER_ID })
        .onConflictDoNothing({
          target: [schema.customerUsers.customerId, schema.customerUsers.userId],
        })
    }

    // Openable: both client-visibility gates (clientVisibleAt + publishedAt) are set —
    // sectionFreshness is only ever non-false once a claim has left "Primljeno".
    async function createOpenableClaim(customerId: string, mrPrefix: string): Promise<string> {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          customerId,
          mrNumber: `${mrPrefix}-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientVisibleAt: new Date(), publishedAt: new Date() })
        .where(eq(schema.emotiveClaims.id, created.id))
      return created.id
    }

    async function setSectionUpdatedAt(
      id: string,
      sections: Record<string, string>,
    ): Promise<void> {
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ sectionUpdatedAt: sections })
        .where(eq(schema.emotiveClaims.id, id))
    }

    async function seedView(claimId: string, userId: string, viewedAt: Date): Promise<void> {
      await ctx.db
        .insert(schema.emotiveClaimClientViews)
        .values({ userId, emotiveClaimId: claimId, viewedAt })
        .onConflictDoUpdate({
          target: [
            schema.emotiveClaimClientViews.userId,
            schema.emotiveClaimClientViews.emotiveClaimId,
          ],
          set: { viewedAt },
        })
    }

    it('flags a section true when its section_updated_at is set and never viewed', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createOpenableClaim(customerId, 'SF1')
      await setSectionUpdatedAt(id, { photos: new Date().toISOString() })

      const found = await container.emotiveClaimsRepository.findById(id, {
        type: 'own_customer',
        userId: TEST_USER_ID,
      })

      expect(found).not.toBeNull()
      expect(found!.sectionFreshness).toEqual({
        photos: true,
        inspection: false,
        details: false,
        outcome: false,
      })
    })

    it('clears a section once viewedAt is at/after that section’s timestamp', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createOpenableClaim(customerId, 'SF2')
      const sectionTs = new Date('2026-04-17T10:00:00.000Z')
      await setSectionUpdatedAt(id, { photos: sectionTs.toISOString() })
      await seedView(id, TEST_USER_ID, new Date('2026-04-17T10:00:01.000Z'))

      const found = await container.emotiveClaimsRepository.findById(id, {
        type: 'own_customer',
        userId: TEST_USER_ID,
      })

      expect(found).not.toBeNull()
      expect(found!.sectionFreshness).toEqual({
        photos: false,
        inspection: false,
        details: false,
        outcome: false,
      })
    })

    it('reports all-false for a Primljeno claim (both visibility gates null)', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          customerId,
          mrNumber: `SF3-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      await setSectionUpdatedAt(created.id, { photos: new Date().toISOString() })

      const found = await container.emotiveClaimsRepository.findById(created.id, {
        type: 'own_customer',
        userId: TEST_USER_ID,
      })

      expect(found).not.toBeNull()
      expect(found!.sectionFreshness).toEqual({
        photos: false,
        inspection: false,
        details: false,
        outcome: false,
      })
    })

    it('reports all-false for a full-view (internal) actor, regardless of section state', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      const id = await createOpenableClaim(customerId, 'SF4')
      await setSectionUpdatedAt(id, {
        photos: new Date().toISOString(),
        outcome: new Date().toISOString(),
      })

      const found = await container.emotiveClaimsRepository.findById(id, { type: 'all' })

      expect(found).not.toBeNull()
      expect(found!.sectionFreshness).toEqual({
        photos: false,
        inspection: false,
        details: false,
        outcome: false,
      })
    })

    it('mixes freshness per section — one seen, one not', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createOpenableClaim(customerId, 'SF5')
      const oldTs = new Date('2026-04-01T00:00:00.000Z')
      const newTs = new Date('2026-04-10T00:00:00.000Z')
      await setSectionUpdatedAt(id, {
        photos: oldTs.toISOString(),
        inspection: newTs.toISOString(),
      })
      await seedView(id, TEST_USER_ID, new Date('2026-04-05T00:00:00.000Z'))

      const found = await container.emotiveClaimsRepository.findById(id, {
        type: 'own_customer',
        userId: TEST_USER_ID,
      })

      expect(found).not.toBeNull()
      expect(found!.sectionFreshness).toEqual({
        photos: false, // viewed after photos was bumped
        inspection: true, // bumped after the view
        details: false,
        outcome: false,
      })
    })

    it('isolates freshness per user — user A viewing does not clear it for user B', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      const userA = TEST_USER_ID
      const userB = '00000000-0000-4000-8000-000000000099'
      await ensureTestUser(ctx.db, userB)
      await linkUserToCustomer(customerId, userA)
      await linkUserToCustomer(customerId, userB)
      const id = await createOpenableClaim(customerId, 'SF6')
      await setSectionUpdatedAt(id, { details: new Date().toISOString() })
      await seedView(id, userA, new Date())

      const foundA = await container.emotiveClaimsRepository.findById(id, {
        type: 'own_customer',
        userId: userA,
      })
      const foundB = await container.emotiveClaimsRepository.findById(id, {
        type: 'own_customer',
        userId: userB,
      })

      expect(foundA).not.toBeNull()
      expect(foundB).not.toBeNull()
      expect(foundA!.sectionFreshness.details).toBe(false)
      expect(foundB!.sectionFreshness.details).toBe(true)
    })

    it('findById never clears the marker on its own; only markClientSeen advances viewedAt', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const id = await createOpenableClaim(customerId, 'SF7')
      await setSectionUpdatedAt(id, { inspection: new Date().toISOString() })

      const firstOpen = await container.emotiveClaimsService.findById(id, OWN_CUSTOMER_VIEWER)
      expect(firstOpen.sectionFreshness.inspection).toBe(true)

      // A second pure read must NOT clear it (this is the whole point of Task 1 —
      // the detail GET is idempotent/read-only).
      const secondOpen = await container.emotiveClaimsService.findById(id, OWN_CUSTOMER_VIEWER)
      expect(secondOpen.sectionFreshness.inspection).toBe(true)

      // Only the explicit mark-seen call advances viewedAt past the section bump.
      await container.emotiveClaimsService.markClientSeen(id, OWN_CUSTOMER_VIEWER)

      const thirdOpen = await container.emotiveClaimsService.findById(id, OWN_CUSTOMER_VIEWER)
      expect(thirdOpen.sectionFreshness.inspection).toBe(false)
    })
  })

  describe('Gate A — first client-visible inspection report advances the claim to "u obradi"', () => {
    it('sets client_visible_at when an operator fills a non-empty inspection report on a Primljeno claim', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `GATEA-${crypto.randomUUID().slice(0, 8)}/26` }),
        FULL_OPERATOR,
        auditContext,
      )
      expect(created.clientVisibleAt).toBeNull()

      const updated = await container.emotiveClaimsService.update(
        created.id,
        {
          categoryId: defaultCategoryId,
          inspectionReport: 'Pregled izvrsen, motor u ispravnom stanju',
        },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.clientVisibleAt).not.toBeNull()
    })

    it('is monotonic: clearing the report afterward leaves client_visible_at unchanged', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `GATEA2-${crypto.randomUUID().slice(0, 8)}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      const filled = await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, inspectionReport: 'Prvobitni nalaz' },
        FULL_OPERATOR,
        auditContext,
      )
      const firstStamp = filled.clientVisibleAt
      expect(firstStamp).not.toBeNull()

      const cleared = await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, inspectionReport: null },
        FULL_OPERATOR,
        auditContext,
      )

      expect(cleared.inspectionReport).toBeNull()
      expect(cleared.clientVisibleAt).toEqual(firstStamp)
    })

    it('leaves client_visible_at null when updating unrelated fields without an inspection report', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `GATEA3-${crypto.randomUUID().slice(0, 8)}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      const updated = await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, engineCode: 'ENG-CODE-1' },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.clientVisibleAt).toBeNull()
    })

    it('starts client-visible when created with a non-empty inspection report', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          mrNumber: `GATEA4-${crypto.randomUUID().slice(0, 8)}/26`,
          inspectionReport: 'Nalaz popunjen odmah pri kreiranju',
        }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.clientVisibleAt).not.toBeNull()
    })

    it('stays Primljeno (client_visible_at null) when created without an inspection report', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `GATEA5-${crypto.randomUUID().slice(0, 8)}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.clientVisibleAt).toBeNull()
    })
  })

  describe('compare-and-swap guard (TOCTOU)', () => {
    it('refuses to update a claim soft-deleted after the before-read → ConflictError, row unchanged', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          warrantyReport: 'Originalni nalaz',
          mrNumber: `CAS-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      const before = await container.emotiveClaimsRepository.findById(created.id, { type: 'all' })
      expect(before).not.toBeNull()

      // A concurrent delete commits between the service before-read and the repo UPDATE.
      await container.emotiveClaimsService.softDelete(created.id, FULL_OPERATOR, auditContext)

      await expect(
        container.emotiveClaimsRepository.update(
          created.id,
          { categoryId: defaultCategoryId, warrantyReport: 'RACED' },
          TEST_USER_ID,
          before!,
          { type: 'all' },
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      const [raw] = await ctx.db
        .select()
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, created.id))
      expect(raw?.warrantyReport).toBe('Originalni nalaz')
    })

    it('refuses to update a claim whose outcome changed after the before-read → ConflictError', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          warrantyReport: 'Originalni nalaz',
          mrNumber: `CAS2-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      const before = await container.emotiveClaimsRepository.findById(created.id, { type: 'all' })

      // A concurrent outcome change (pending → accepted) lands first.
      await container.emotiveClaimsService.changeOutcome(
        created.id,
        { outcome: ClaimOutcome.Accepted },
        FULL_OPERATOR,
        auditContext,
      )

      await expect(
        container.emotiveClaimsRepository.update(
          created.id,
          { categoryId: defaultCategoryId, warrantyReport: 'RACED' },
          TEST_USER_ID,
          before!,
          { type: 'all' },
        ),
      ).rejects.toBeInstanceOf(ConflictError)

      const [raw] = await ctx.db
        .select()
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, created.id))
      expect(raw?.warrantyReport).toBe('Originalni nalaz')
    })
  })

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

    it('stores and updates the client-visible inspection report', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ inspectionReport: 'Cylinder head within tolerance.' }),
        FULL_OPERATOR,
        auditContext,
      )
      expect(created.inspectionReport).toBe('Cylinder head within tolerance.')

      await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, inspectionReport: 'Updated: valve seats re-cut.' },
        FULL_OPERATOR,
        auditContext,
      )

      const detail = await container.emotiveClaimsService.findById(created.id, FULL_OPERATOR)
      expect(detail.inspectionReport).toBe('Updated: valve seats re-cut.')
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

      // The violation is deliberate, so it has to happen inside its own savepoint: a failed
      // statement aborts the surrounding transaction, and every test now runs in one.
      await expect(
        ctx.db.transaction(async (tx) =>
          tx.insert(schema.emotiveClaimFaults).values({
            claimId: created.id,
            faultType: FaultType.Employee,
            employeeId: null,
            departmentId: null,
            externalPartyId: null,
          }),
        ),
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

    it('refuses a category that does not exist, instead of letting the FK raise a 500', async () => {
      // Every other reference on a claim is checked for existence and life before the insert
      // (engine type, manufacturer, worker, source, customer). The category was the one that
      // was not — and it is the only one the server REQUIRES, so a stale id reached Postgres
      // and came back as an unhandled foreign-key error.
      await expect(
        container.emotiveClaimsService.create(
          await buildCreateInput({ mrNumber: 'CAT-GHOST/26', categoryId: crypto.randomUUID() }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('refuses a category the office has switched off', async () => {
      const categoryId = await getClaimCategoryIdByCode(ctx.db, 'MASINSKA_OBRADA')
      await ctx.db
        .update(schema.claimCategories)
        .set({ isActive: false })
        .where(eq(schema.claimCategories.id, categoryId))

      await expect(
        container.emotiveClaimsService.create(
          await buildCreateInput({ mrNumber: 'CAT-OFF/26', categoryId }),
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ValidationError)

      await ctx.db
        .update(schema.claimCategories)
        .set({ isActive: true })
        .where(eq(schema.claimCategories.id, categoryId))
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
        { categoryId: defaultCategoryId, mrNumber: newMrNumber },
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
          { categoryId: defaultCategoryId, mrNumber: keepMrNumber },
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

    it('returns the category on the detail, resolved to code and name', async () => {
      const remontCategoryId = await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA')
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          categoryId: remontCategoryId,
          mrNumber: `CATEGORY-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const detail = await container.emotiveClaimsService.findById(created.id, FULL_OPERATOR)

      expect(detail.category).toEqual({
        id: remontCategoryId,
        code: 'REMONT_MOTORA',
        name: 'Generalni remont motora',
      })
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
        { categoryId: defaultCategoryId, manufacturerId: null },
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

  describe('when the claim carries a switched-off category', () => {
    async function switchOffCategory(code: string): Promise<string> {
      const categoryId = await getClaimCategoryIdByCode(ctx.db, code)
      await ctx.db
        .update(schema.claimCategories)
        .set({ isActive: false })
        .where(eq(schema.claimCategories.id, categoryId))
      return categoryId
    }

    afterEach(async () => {
      await ctx.db.update(schema.claimCategories).set({ isActive: true })
    })

    it('keeps letting the claim be edited without losing the category it already has', async () => {
      // The form deliberately keeps a switched-off category selectable on the claim that
      // carries it (commit 3720d8f). If the server refused it, editing anything else on such
      // a claim would fail — the office would have to re-open a retired category to fix a typo.
      const categoryId = await getClaimCategoryIdByCode(ctx.db, 'MASINSKA_OBRADA')
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ categoryId, mrNumber: `CAT-KEEP-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )
      await switchOffCategory('MASINSKA_OBRADA')

      const updated = await container.emotiveClaimsService.update(
        created.id,
        { categoryId, warrantyReport: 'Dopunjen opis' },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.category?.code).toBe('MASINSKA_OBRADA')
      expect(updated.warrantyReport).toBe('Dopunjen opis')
    })

    it('still refuses to MOVE a claim into a switched-off category', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `CAT-MOVE-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )
      const retiredId = await switchOffCategory('MASINSKA_OBRADA')

      await expect(
        container.emotiveClaimsService.update(
          created.id,
          { categoryId: retiredId },
          FULL_OPERATOR,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('when assigned employee is set', () => {
    it('persists the assigned worker on create, resolves the name, and clears it on update', async () => {
      const employeeId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )

      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ employeeId, mrNumber: `EMP-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.employeeId).toBe(employeeId)
      expect(created.employeeName).toBeTruthy()

      const cleared = await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, employeeId: null },
        FULL_OPERATOR,
        auditContext,
      )

      expect(cleared.employeeId).toBeNull()
      expect(cleared.employeeName).toBeNull()
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
          categoryId: defaultCategoryId,
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

    it('refuses to create a claim without a category', () => {
      const result = EmotiveClaimCreateInputSchema.safeParse({
        engineTypeId: crypto.randomUUID(),
        dateOfClaim: '2026-01-01',
        mrNumber: 'CAT-CREATE/26',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('EmotiveClaimUpdateInputSchema', () => {
    it('accepts a partial edit that says nothing about the category', () => {
      // This schema used to REQUIRE the category on every PATCH, which read like a guarantee
      // and was none: the field is not nullable, so leaving it out can only mean "as it was".
      // What it did do was break every editor that PATCHes its own slice — the inspection
      // report (Gate A), the faults, the findings — each of which sends one key.
      expect(EmotiveClaimUpdateInputSchema.safeParse({ warrantyReport: 'Ažurirano' }).success).toBe(
        true,
      )
      expect(
        EmotiveClaimUpdateInputSchema.safeParse({ inspectionReport: 'Head gasket blown' }).success,
      ).toBe(true)
    })

    it('still refuses a category that is not a category id', () => {
      expect(EmotiveClaimUpdateInputSchema.safeParse({ categoryId: 'REMONT_MOTORA' }).success).toBe(
        false,
      )
      expect(EmotiveClaimUpdateInputSchema.safeParse({ categoryId: null }).success).toBe(false)
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

  describe('publish (Gate B — explicit client-visibility reveal)', () => {
    it('stamps published_at, audits the transition as changes.transition === "publish", and publishes claim_updated', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          mrNumber: `PUBLISH-${Date.now()}/26`,
          outcome: ClaimOutcome.Accepted,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      expect(created.publishedAt).toBeNull()
      receivedEvents.length = 0

      const published = await container.emotiveClaimsService.publish(created.id, auditContext)

      expect(published.publishedAt).not.toBeNull()
      expect(published.outcome).toBe(ClaimOutcome.Accepted)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))
      const publishRow = auditRows.find(
        (row) => (row.changes as { transition?: string } | null)?.transition === 'publish',
      )
      expect(publishRow).toBeDefined()
      expect(publishRow?.action).toBe(AuditAction.Update)

      expect(receivedEvents).toContainEqual({
        type: ClaimEventType.Updated,
        payload: { kind: ClaimKind.Emotive, id: created.id },
      })
    })

    it('is idempotent: publishing an already-published claim leaves published_at unchanged and emits no second audit/SSE', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `PUBLISH-IDEMPOTENT-${Date.now()}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      const first = await container.emotiveClaimsService.publish(created.id, auditContext)
      expect(first.publishedAt).not.toBeNull()

      const auditCountAfterFirst = (
        await ctx.db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, created.id))
      ).length
      const eventCountAfterFirst = receivedEvents.length

      const second = await container.emotiveClaimsService.publish(created.id, auditContext)
      expect(second.publishedAt).toEqual(first.publishedAt)

      const auditCountAfterSecond = (
        await ctx.db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, created.id))
      ).length
      expect(auditCountAfterSecond).toBe(auditCountAfterFirst)
      expect(receivedEvents.length).toBe(eventCountAfterFirst)
    })
  })

  describe('client_content_updated_at (Phase 3 freshness bump)', () => {
    async function getClientContentUpdatedAt(id: string): Promise<Date | null> {
      const [row] = await ctx.db
        .select({ clientContentUpdatedAt: schema.emotiveClaims.clientContentUpdatedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, id))
      return row?.clientContentUpdatedAt ?? null
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-07-18T09:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('bumps client_content_updated_at when a whitelisted field (inspectionReport) is updated', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`FRESH1-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `FRESH1-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      const beforeStamp = await getClientContentUpdatedAt(created.id)

      vi.setSystemTime(new Date('2026-07-18T09:05:00Z'))
      await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, inspectionReport: 'Pregled izvrsen, sve u redu' },
        FULL_OPERATOR,
        auditContext,
      )

      const afterStamp = await getClientContentUpdatedAt(created.id)
      expect(afterStamp).not.toBeNull()
      expect(afterStamp).toEqual(new Date('2026-07-18T09:05:00Z'))
      expect(beforeStamp === null || afterStamp!.getTime() > beforeStamp.getTime()).toBe(true)
    })

    it('does NOT bump client_content_updated_at when only internalNotes changes', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`FRESH2-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `FRESH2-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      const beforeStamp = await getClientContentUpdatedAt(created.id)

      vi.setSystemTime(new Date('2026-07-18T09:05:00Z'))
      await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, internalNotes: 'Interna napomena, klijent je ne vidi' },
        FULL_OPERATOR,
        auditContext,
      )

      const afterStamp = await getClientContentUpdatedAt(created.id)
      expect(afterStamp).toEqual(beforeStamp)
    })

    it('does NOT bump client_content_updated_at when a client-visible field is cleared', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`FRESHCLR-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `FRESHCLR-${crypto.randomUUID().slice(0, 8)}/26`,
          warrantyReport: 'Originalni nalaz',
        }),
        FULL_OPERATOR,
        auditContext,
      )
      const beforeStamp = await getClientContentUpdatedAt(created.id)

      vi.setSystemTime(new Date('2026-07-18T09:05:00Z'))
      // Clearing a whitelisted field is a removal, not new content → no badge bump.
      await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, warrantyReport: '' },
        FULL_OPERATOR,
        auditContext,
      )

      const afterStamp = await getClientContentUpdatedAt(created.id)
      expect(afterStamp).toEqual(beforeStamp)
    })

    it('bumps client_content_updated_at on publish (Gate B)', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`FRESH3-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `FRESH3-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      const beforeStamp = await getClientContentUpdatedAt(created.id)

      vi.setSystemTime(new Date('2026-07-18T09:05:00Z'))
      await container.emotiveClaimsService.publish(created.id, auditContext)

      const afterStamp = await getClientContentUpdatedAt(created.id)
      expect(afterStamp).not.toBeNull()
      expect(afterStamp).toEqual(new Date('2026-07-18T09:05:00Z'))
      expect(beforeStamp === null || afterStamp!.getTime() > beforeStamp.getTime()).toBe(true)
    })

    it('sets client_content_updated_at on create when a whitelisted field is filled', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`FRESH4-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `FRESH4-${crypto.randomUUID().slice(0, 8)}/26`,
          inspectionReport: 'Nalaz popunjen odmah pri kreiranju',
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const stamp = await getClientContentUpdatedAt(created.id)
      expect(stamp).not.toBeNull()
      expect(stamp).toEqual(new Date('2026-07-18T09:00:00Z'))
    })
  })

  describe('section_updated_at (Phase 3.1 per-section markers)', () => {
    async function getSectionUpdatedAt(id: string): Promise<Record<string, string> | null> {
      const [row] = await ctx.db
        .select({ sectionUpdatedAt: schema.emotiveClaims.sectionUpdatedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, id))
      return row?.sectionUpdatedAt ?? null
    }

    it('sets section_updated_at.inspection when inspectionReport is updated, without re-bumping details', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`SEC1-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `SEC1-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      // Required create fields (engineTypeId/dateOfClaim/mrNumber) are 'details' triggers,
      // so 'details' is already stamped at creation — same as clientContentUpdatedAt.
      const afterCreate = await getSectionUpdatedAt(created.id)
      expect(afterCreate?.['inspection']).toBeUndefined()
      expect(afterCreate?.['details']).toBeDefined()

      await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, inspectionReport: 'Pregled izvrsen, sve u redu' },
        FULL_OPERATOR,
        auditContext,
      )

      const sections = await getSectionUpdatedAt(created.id)
      expect(sections?.['inspection']).toBeDefined()
      // Scoping guarantee: an inspection-only update never re-bumps the details key.
      expect(sections?.['details']).toBe(afterCreate?.['details'])
    })

    it('bumps section_updated_at.details when a details field (engineCode) is updated, leaves inspection absent', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`SEC2-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `SEC2-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      const afterCreate = await getSectionUpdatedAt(created.id)
      const detailsAtCreate = afterCreate?.['details']
      expect(detailsAtCreate).toBeDefined()

      await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, engineCode: 'ENG-CODE-123' },
        FULL_OPERATOR,
        auditContext,
      )

      const sections = await getSectionUpdatedAt(created.id)
      expect(sections?.['details']).toBeDefined()
      // Actually re-stamped, not just left over from creation. Deliberately NOT an ordering
      // comparison: create stamps this in JS (`new Date()`) while update stamps it in SQL
      // (`to_jsonb(now())`), and `now()` is fixed at the start of the transaction — which, with
      // one transaction per test, is earlier than any JS clock reading taken inside it. The two
      // values come from different clocks, so only "it changed" is a statement about the code.
      expect(sections!['details']).not.toBe(detailsAtCreate)
      expect(sections?.['inspection']).toBeUndefined()
    })

    it('sets BOTH inspection and details when inspectionReport and engineCode are updated together', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`SEC3-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `SEC3-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.update(
        created.id,
        {
          categoryId: defaultCategoryId,
          inspectionReport: 'Pregled izvrsen',
          engineCode: 'ENG-CODE-456',
        },
        FULL_OPERATOR,
        auditContext,
      )

      const sections = await getSectionUpdatedAt(created.id)
      expect(sections?.['inspection']).toBeDefined()
      expect(sections?.['details']).toBeDefined()
    })

    it('leaves section_updated_at unchanged (leak-prevention) when only internalNotes changes', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`SEC4-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `SEC4-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      const beforeUpdate = await getSectionUpdatedAt(created.id)

      await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, internalNotes: 'Interna napomena, klijent je ne vidi' },
        FULL_OPERATOR,
        auditContext,
      )

      // internalNotes routes to NO section key — the internal-only edit leaves every
      // existing key exactly as it was (no re-bump), same guarantee client_content_updated_at has.
      expect(await getSectionUpdatedAt(created.id)).toEqual(beforeUpdate)
    })

    it('does NOT re-stamp section_updated_at.details when a details field (warrantyReport) is cleared', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`SECCLR-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `SECCLR-${crypto.randomUUID().slice(0, 8)}/26`,
          warrantyReport: 'Originalni nalaz',
        }),
        FULL_OPERATOR,
        auditContext,
      )
      const beforeUpdate = await getSectionUpdatedAt(created.id)
      expect(beforeUpdate?.['details']).toBeDefined()

      await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, warrantyReport: '' },
        FULL_OPERATOR,
        auditContext,
      )

      // Clearing routes to no section key — details stays exactly as create stamped it.
      const sections = await getSectionUpdatedAt(created.id)
      expect(sections?.['details']).toBe(beforeUpdate?.['details'])
    })

    it('blank inspectionReport edit sets no inspection marker and does not stamp client_visible_at; a non-blank edit does both', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`SECINS-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `SECINS-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )
      expect(created.clientVisibleAt).toBeNull()

      // Blank report: no 'inspection' marker, and Gate A does not fire.
      const blank = await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, inspectionReport: '   ' },
        FULL_OPERATOR,
        auditContext,
      )
      expect(blank.clientVisibleAt).toBeNull()
      expect((await getSectionUpdatedAt(created.id))?.['inspection']).toBeUndefined()

      // Non-blank report: marker set AND Gate A stamps client_visible_at (COALESCE unchanged).
      const filled = await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, inspectionReport: 'Pregled izvrsen, sve u redu' },
        FULL_OPERATOR,
        auditContext,
      )
      expect(filled.clientVisibleAt).not.toBeNull()
      expect((await getSectionUpdatedAt(created.id))?.['inspection']).toBeDefined()
    })

    it('sets section_updated_at.outcome on publish (Gate B)', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`SEC5-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `SEC5-${crypto.randomUUID().slice(0, 8)}/26`,
        }),
        FULL_OPERATOR,
        auditContext,
      )

      await container.emotiveClaimsService.publish(created.id, auditContext)

      const sections = await getSectionUpdatedAt(created.id)
      expect(sections?.['outcome']).toBeDefined()
    })

    it('sets section_updated_at.inspection on create when inspectionReport is filled', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          engineTypeId: await createEngineType(`SEC6-${crypto.randomUUID().slice(0, 8)}`),
          mrNumber: `SEC6-${crypto.randomUUID().slice(0, 8)}/26`,
          inspectionReport: 'Nalaz popunjen odmah pri kreiranju',
        }),
        FULL_OPERATOR,
        auditContext,
      )

      const sections = await getSectionUpdatedAt(created.id)
      expect(sections?.['inspection']).toBeDefined()
    })
  })

  describe('editing freedom (completed claims, no outcome lock)', () => {
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

    it('lets an operator edit a field on a completed claim without reopening', async () => {
      const id = await createCompletedClaim()

      const updated = await container.emotiveClaimsService.update(
        id,
        { categoryId: defaultCategoryId, warrantyReport: 'pokusaj izmene' },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.warrantyReport).toBe('pokusaj izmene')
    })

    it('allows internalNotes update on a completed claim', async () => {
      const id = await createCompletedClaim()

      const updated = await container.emotiveClaimsService.update(
        id,
        { categoryId: defaultCategoryId, internalNotes: 'Nalaz posle prihvatanja' },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.internalNotes).toBe('Nalaz posle prihvatanja')
    })

    it('lets an operator replace faults on a completed claim without reopening', async () => {
      const id = await createCompletedClaim()
      const departmentId = await getDepartmentIdByCode(ctx.db, 'GLAVE')

      const updated = await container.emotiveClaimsService.update(
        id,
        {
          categoryId: defaultCategoryId,
          faults: [{ faultType: FaultType.Department, departmentId }],
        },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.faults).toEqual([
        expect.objectContaining({ faultType: FaultType.Department, departmentId }),
      ])
    })

    it('lets an operator re-decide accepted → rejected directly without reopening', async () => {
      const id = await createCompletedClaim()

      const updated = await container.emotiveClaimsService.changeOutcome(
        id,
        { outcome: ClaimOutcome.Rejected },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.outcome).toBe(ClaimOutcome.Rejected)
    })

    it('lets an operator without reopen permission move a completed claim back to pending', async () => {
      const id = await createCompletedClaim()

      const updated = await container.emotiveClaimsService.changeOutcome(
        id,
        { outcome: ClaimOutcome.Pending },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.outcome).toBe(ClaimOutcome.Pending)
    })

    it('audits an outcome change on a completed claim without a reopen transition tag', async () => {
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

      const pendingAudited = auditRows.some(
        (row) =>
          row.action === AuditAction.Update &&
          (row.changes as { outcome?: string; transition?: string } | null)?.['outcome'] ===
            ClaimOutcome.Pending &&
          (row.changes as { transition?: string } | null)?.transition === undefined,
      )
      expect(pendingAudited).toBe(true)
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
        { categoryId: defaultCategoryId, warrantyReport: 'izmena posle otkljucavanja' },
        FULL_OPERATOR,
        auditContext,
      )
      expect(updated.warrantyReport).toBe('izmena posle otkljucavanja')
    })

    it('lets an operator delete a completed claim without reopen permission', async () => {
      const id = await createCompletedClaim()

      await expect(
        container.emotiveClaimsService.softDelete(id, FULL_OPERATOR, auditContext),
      ).resolves.toBeUndefined()
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
          categoryId: defaultCategoryId,
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
        { categoryId: defaultCategoryId, dateOfClaim: new Date('2026-08-01') },
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
        { categoryId: defaultCategoryId, engineCode: 'MR-ENG-7788' },
        FULL_OPERATOR,
        auditContext,
      )
      expect(withCode.engineCode).toBe('MR-ENG-7788')

      const cleared = await container.emotiveClaimsService.update(
        created.id,
        { categoryId: defaultCategoryId, engineCode: null },
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

  describe('findings', () => {
    it('round-trips findings on create and replaces the whole list on update', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({
          mrNumber: `FIND-${crypto.randomUUID().slice(0, 8)}/26`,
          findings: [
            { text: 'Ogrebotina na glavi motora', type: 'mehanika' },
            { text: 'Curenje ulja oko zaptivača', type: '' },
          ],
        }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.findings).toEqual([
        { text: 'Ogrebotina na glavi motora', type: 'mehanika' },
        { text: 'Curenje ulja oko zaptivača', type: '' },
      ])

      const updated = await container.emotiveClaimsService.update(
        created.id,
        {
          categoryId: defaultCategoryId,
          findings: [{ text: 'Prepravljen nalaz', type: 'elektrika' }],
        },
        FULL_OPERATOR,
        auditContext,
      )

      expect(updated.findings).toEqual([{ text: 'Prepravljen nalaz', type: 'elektrika' }])
    })

    it('creates a claim with an empty findings list when none are given', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `FIND0-${crypto.randomUUID().slice(0, 8)}/26` }),
        FULL_OPERATOR,
        auditContext,
      )

      expect(created.findings).toEqual([])
    })

    // Findings are internal-only (like internalNotes) — they must never reach the
    // client wire, so editing them must not raise the portal NEW/UPDATE badge.
    it('does NOT bump client_content_updated_at when only findings change', async () => {
      const created = await container.emotiveClaimsService.create(
        await buildCreateInput({ mrNumber: `FINDFRESH-${crypto.randomUUID().slice(0, 8)}/26` }),
        FULL_OPERATOR,
        auditContext,
      )
      const [before] = await ctx.db
        .select({ stamp: schema.emotiveClaims.clientContentUpdatedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, created.id))

      await container.emotiveClaimsService.update(
        created.id,
        {
          categoryId: defaultCategoryId,
          findings: [{ text: 'Interni nalaz koji klijent ne vidi', type: '' }],
        },
        FULL_OPERATOR,
        auditContext,
      )

      const [after] = await ctx.db
        .select({ stamp: schema.emotiveClaims.clientContentUpdatedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, created.id))
      expect(after?.stamp).toEqual(before?.stamp)
    })
  })
})
