import { createPool, getIntegrationDatabaseUrl, schema } from '@mr/db'
import { AuditAction, ERROR_CODE, ResourceChangedKey } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import {
  LEGACY_LEAKED_ENGINE_MANUFACTURER_CODES,
  purgeCommittedEngineManufacturersByCode,
} from '../../../test-helpers/engine-manufacturer-cleanup.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import {
  buildTestContainer,
  createReferenceTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const CREATE_AUDIT_MFG_CODE = 'CREATE-AUDIT-MFG'

describe('EngineManufacturers reference module', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    const bootstrapPool = createPool(getIntegrationDatabaseUrl())
    try {
      await purgeCommittedEngineManufacturersByCode(bootstrapPool, [
        ...LEGACY_LEAKED_ENGINE_MANUFACTURER_CODES,
        CREATE_AUDIT_MFG_CODE,
      ])
    } finally {
      await bootstrapPool.end()
    }

    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  describe('when listing', () => {
    it('excludes soft-deleted manufacturers', async () => {
      await ctx.db.insert(schema.engineManufacturers).values({
        code: 'DELETED-MFG',
        name: 'Deleted Mfg',
        sortOrder: 999,
        isActive: true,
        deletedAt: new Date(),
      })

      const result = await container.engineManufacturersRepository.list({
        activeOnly: true,
        limit: 50,
      })
      expect(result.items.some((item) => item.code === 'DELETED-MFG')).toBe(false)
    })

    it('orders by sortOrder', async () => {
      await container.engineManufacturersRepository.create({
        code: 'SORT-B',
        name: 'Sort B',
        sortOrder: 2000,
      })
      await container.engineManufacturersRepository.create({
        code: 'SORT-A',
        name: 'Sort A',
        sortOrder: 1000,
      })

      const result = await container.engineManufacturersRepository.list({
        activeOnly: true,
        limit: 50,
        search: 'SORT-',
      })

      const sortAIndex = result.items.findIndex((item) => item.code === 'SORT-A')
      const sortBIndex = result.items.findIndex((item) => item.code === 'SORT-B')
      expect(sortAIndex).toBeGreaterThanOrEqual(0)
      expect(sortBIndex).toBeGreaterThanOrEqual(0)
      expect(sortAIndex).toBeLessThan(sortBIndex)
    })

    it('includes usageCount from emotive and domace claims', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'USAGE-MFG',
        name: 'Usage Mfg',
      })
      const engineTypeId = await container.engineTypesRepository
        .create({ code: 'USAGE-MFG-ENG', manufacturerId: created.id })
        .then((row) => row.id)

      await ctx.db.insert(schema.emotiveClaims).values({
        warrantyReport: 'Usage count test',
        engineTypeId,
        dateOfClaim: new Date('2026-01-15'),
        mrNumber: 'MR-USAGE-MFG',
        outcome: 'pending',
        claimYear: 2026,
        manufacturerId: created.id,
        createdBy: TEST_USER_ID,
      })

      await ctx.db.insert(schema.domaceClaims).values({
        outcome: 'pending',
        claimYear: 2026,
        manufacturerId: created.id,
        createdBy: TEST_USER_ID,
      })

      const found = await container.engineManufacturersRepository.findById(created.id)
      expect(found?.usageCount).toBe(2)
    })
  })

  describe('when creating', () => {
    it('creates manufacturer with defaults and writes audit log', async () => {
      const created = await container.engineManufacturersService.create(
        { code: CREATE_AUDIT_MFG_CODE, name: 'Test BMW', sortOrder: 15 },
        {
          actorUserId: testUser(['settings.engine_manufacturers.create']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(created.code).toBe(CREATE_AUDIT_MFG_CODE)
      expect(created.name).toBe('Test BMW')
      expect(created.sortOrder).toBe(15)
      expect(created.isActive).toBe(true)
      expect(created.usageCount).toBe(0)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows).toHaveLength(1)
      expect(auditRows[0]?.action).toBe(AuditAction.Create)
      expect(auditRows[0]?.entityType).toBe('engine_manufacturer')
    })

    it('emits resource_changed on create', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)

      await scopedContainer.engineManufacturersService.create(
        { code: 'SSE-CREATE-MFG', name: 'SSE Create' },
        {
          actorUserId: testUser(['settings.engine_manufacturers.create']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.EngineManufacturers },
      ])
    })

    it('throws conflict for duplicate code', async () => {
      await container.engineManufacturersRepository.create({
        code: 'DUP-MFG',
        name: 'Duplicate',
      })

      await expect(
        container.engineManufacturersService.create(
          { code: 'DUP-MFG', name: 'Duplicate again' },
          {
            actorUserId: testUser(['settings.engine_manufacturers.create']).id,
            actorIp: null,
            actorUserAgent: null,
          },
        ),
      ).rejects.toMatchObject({ status: 409 })
    })
  })

  describe('when updating', () => {
    it('updates name and sortOrder with audit log', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'UPD-MFG',
        name: 'Before',
        sortOrder: 10,
      })

      const updated = await container.engineManufacturersService.update(
        created.id,
        { name: 'After', sortOrder: 20 },
        {
          actorUserId: testUser(['settings.engine_manufacturers.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(updated.name).toBe('After')
      expect(updated.sortOrder).toBe(20)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows.some((row) => row.action === AuditAction.Update)).toBe(true)
    })

    it('reactivates manufacturer via PATCH isActive with audit log', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'REACT-MFG',
        name: 'Reactivate Me',
      })
      await container.engineManufacturersRepository.update(created.id, { isActive: false })

      const reactivated = await container.engineManufacturersService.update(
        created.id,
        { isActive: true },
        {
          actorUserId: testUser(['settings.engine_manufacturers.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(reactivated.isActive).toBe(true)
    })

    it('emits resource_changed on reactivation', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await scopedContainer.engineManufacturersRepository.create({
        code: 'SSE-REACT-MFG',
        name: 'SSE Reactivate',
      })
      await scopedContainer.engineManufacturersRepository.update(created.id, { isActive: false })
      eventBus.resourceEvents.length = 0

      await scopedContainer.engineManufacturersService.update(
        created.id,
        { isActive: true },
        {
          actorUserId: testUser(['settings.engine_manufacturers.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.EngineManufacturers },
      ])
    })
  })

  describe('when deleting', () => {
    it('hard-deletes manufacturer with audit log', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'DEL-MFG',
        name: 'To Delete',
      })

      await container.engineManufacturersService.hardDelete(created.id, {
        actorUserId: testUser(['settings.engine_manufacturers.manage']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      const found = await container.engineManufacturersRepository.findById(created.id)
      expect(found).toBeNull()

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows.some((row) => row.action === AuditAction.Delete)).toBe(true)
    })

    it('rejects hard delete when usageCount is greater than zero', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'USED-MFG',
        name: 'Used Mfg',
      })
      const engineTypeId = await container.engineTypesRepository
        .create({ code: 'USED-MFG-ENG', manufacturerId: created.id })
        .then((row) => row.id)

      await ctx.db.insert(schema.emotiveClaims).values({
        warrantyReport: 'Blocks delete',
        engineTypeId,
        dateOfClaim: new Date('2026-01-15'),
        mrNumber: 'MR-USED-MFG',
        outcome: 'pending',
        claimYear: 2026,
        manufacturerId: created.id,
        createdBy: TEST_USER_ID,
      })

      await expect(
        container.engineManufacturersService.hardDelete(created.id, {
          actorUserId: testUser(['settings.engine_manufacturers.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        }),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('emits resource_changed on hard delete', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await scopedContainer.engineManufacturersRepository.create({
        code: 'SSE-DEL-MFG',
        name: 'SSE Delete',
      })

      await scopedContainer.engineManufacturersService.hardDelete(created.id, {
        actorUserId: testUser(['settings.engine_manufacturers.manage']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.EngineManufacturers },
      ])
    })
  })

  describe('HTTP', () => {
    it('returns 403 on GET without any read permission', async () => {
      const app = createReferenceTestApp(container, testUser(['customers.view']))
      const res = await app.request('/api/engine-manufacturers')
      expect(res.status).toBe(403)
    })

    it('returns 403 on POST without create permission', async () => {
      const app = createReferenceTestApp(container, testUser(['emotive_claims.create']))
      const res = await app.request('/api/engine-manufacturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'HTTP-MFG', name: 'HTTP Mfg' }),
      })
      expect(res.status).toBe(403)
    })

    it('creates manufacturer via POST', async () => {
      const app = createReferenceTestApp(
        container,
        testUser(['settings.engine_manufacturers.create', 'emotive_claims.create']),
      )
      const res = await app.request('/api/engine-manufacturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'HTTP-SKODA', name: 'Škoda', sortOrder: 45 }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        code: string
        name: string
        sortOrder: number
        usageCount: number
      }
      expect(body.code).toBe('HTTP-SKODA')
      expect(body.name).toBe('Škoda')
      expect(body.sortOrder).toBe(45)
      expect(body.usageCount).toBe(0)
    })

    it('lists manufacturers with claim edit permission', async () => {
      await container.engineManufacturersRepository.create({
        code: 'LIST-MFG',
        name: 'List Mfg',
      })
      const app = createReferenceTestApp(container, testUser(['domace_claims.update']))
      const res = await app.request('/api/engine-manufacturers?limit=5')
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: unknown[]; hasMore: boolean }
      expect(body.items.length).toBeGreaterThan(0)
    })

    it('lists manufacturers with claim VIEW permission (list-filter catalog)', async () => {
      // Regression (2026-07-05): viewers hit the claims-list manufacturer
      // filter — read access must not require edit/manage permissions.
      await container.engineManufacturersRepository.create({
        code: 'VIEW-MFG',
        name: 'View Mfg',
      })
      const app = createReferenceTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request('/api/engine-manufacturers?limit=5')
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: unknown[] }
      expect(body.items.length).toBeGreaterThan(0)
    })

    it('updates manufacturer via PATCH with manage permission', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'PATCH-MFG',
        name: 'Patch Me',
      })
      const app = createReferenceTestApp(
        container,
        testUser(['settings.engine_manufacturers.manage']),
      )
      const res = await app.request(`/api/engine-manufacturers/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Patched Name' }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { name: string }
      expect(body.name).toBe('Patched Name')
    })

    it('returns 403 on PATCH without manage permission', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'PATCH-FORBIDDEN',
        name: 'Forbidden',
      })
      const app = createReferenceTestApp(
        container,
        testUser(['settings.engine_manufacturers.create']),
      )
      const res = await app.request(`/api/engine-manufacturers/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nope' }),
      })
      expect(res.status).toBe(403)
    })

    it('hard-deletes manufacturer via DELETE with manage permission', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'DELETE-MFG',
        name: 'Delete Me',
      })
      const app = createReferenceTestApp(
        container,
        testUser(['settings.engine_manufacturers.manage']),
      )
      const res = await app.request(`/api/engine-manufacturers/${created.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')

      const found = await container.engineManufacturersRepository.findById(created.id)
      expect(found).toBeNull()
    })

    it('returns 409 on DELETE when manufacturer is in use', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'DELETE-USED-MFG',
        name: 'Delete Used',
      })
      const engineTypeId = await container.engineTypesRepository
        .create({ code: 'DELETE-USED-ENG', manufacturerId: created.id })
        .then((row) => row.id)

      await ctx.db.insert(schema.emotiveClaims).values({
        warrantyReport: 'Blocks HTTP delete',
        engineTypeId,
        dateOfClaim: new Date('2026-01-15'),
        mrNumber: 'MR-DELETE-USED',
        outcome: 'pending',
        claimYear: 2026,
        manufacturerId: created.id,
        createdBy: TEST_USER_ID,
      })

      const app = createReferenceTestApp(
        container,
        testUser(['settings.engine_manufacturers.manage']),
      )
      const res = await app.request(`/api/engine-manufacturers/${created.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(409)
    })

    it('returns 401 without auth', async () => {
      const app = createReferenceTestApp(container, null)
      const res = await app.request('/api/engine-manufacturers')
      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Unauthorized)
    })
  })
})
