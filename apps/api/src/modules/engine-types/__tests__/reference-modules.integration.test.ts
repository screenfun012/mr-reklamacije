import { schema } from '@mr/db'
import {
  AuditAction,
  CustomerKind,
  ERROR_CODE,
  ExternalPartyKind,
  ResourceChangedKey,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createReferenceTestApp,
  buildTestContainer,
  testUser,
} from '../../../test-helpers/test-app.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import {
  createTestEngineType,
  ensureTestEngineManufacturerId,
} from '../../../test-helpers/engine-type-fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import type { Container } from '../../../core/container.js'

describe('EngineTypes reference module', () => {
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

  describe('when listing', () => {
    it('excludes soft-deleted engine types', async () => {
      await ctx.db.insert(schema.engineTypes).values({
        code: 'DELETED-TYPE',
        isActive: true,
        usageCount: 0,
        deletedAt: new Date(),
      })

      const result = await container.engineTypesRepository.list({ activeOnly: true, limit: 50 })
      expect(result.items.some((item) => item.code === 'DELETED-TYPE')).toBe(false)
    })

    it('paginates with cursor', async () => {
      await createTestEngineType(container, 'PAGE-A')
      await createTestEngineType(container, 'PAGE-B')

      const firstPage = await container.engineTypesRepository.list({ activeOnly: true, limit: 1 })
      expect(firstPage.hasMore).toBe(true)

      const secondPage = await container.engineTypesRepository.list({
        activeOnly: true,
        limit: 1,
        cursor: firstPage.nextCursor ?? undefined,
      })

      expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id)
    })
    it('filters by manufacturerId', async () => {
      const bmwId = await ensureTestEngineManufacturerId(container, 'FILTER-BMW', 'BMW')
      const audiId = await ensureTestEngineManufacturerId(container, 'FILTER-AUDI', 'Audi')
      await createTestEngineType(container, 'FILTER-BMW-TYPE', bmwId)
      await createTestEngineType(container, 'FILTER-AUDI-TYPE', audiId)

      const result = await container.engineTypesRepository.list({
        activeOnly: true,
        limit: 50,
        manufacturerId: bmwId,
      })

      expect(result.items.some((item) => item.code === 'FILTER-BMW-TYPE')).toBe(true)
      expect(result.items.some((item) => item.code === 'FILTER-AUDI-TYPE')).toBe(false)
    })
  })

  describe('when creating', () => {
    it('creates engine type with defaults and writes audit log', async () => {
      const manufacturerId = await ensureTestEngineManufacturerId(container, 'CREATE-BMW', 'BMW')
      const created = await container.engineTypesService.create(
        { code: 'TEST-N47', manufacturerId },
        {
          actorUserId: testUser(['settings.engine_types.create']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(created.code).toBe('TEST-N47')
      expect(created.isActive).toBe(true)
      expect(created.usageCount).toBe(0)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows).toHaveLength(1)
      expect(auditRows[0]?.action).toBe(AuditAction.Create)
      expect(auditRows[0]?.entityType).toBe('engine_type')
    })

    it('throws conflict for duplicate code', async () => {
      await createTestEngineType(container, 'DUP-CODE')

      await expect(
        container.engineTypesService.create(
          { code: 'DUP-CODE', manufacturerId: await ensureTestEngineManufacturerId(container) },
          {
            actorUserId: testUser(['settings.engine_types.create']).id,
            actorIp: null,
            actorUserAgent: null,
          },
        ),
      ).rejects.toMatchObject({ status: 409 })
    })
  })

  describe('when updating', () => {
    it('updates fields including notes with audit log', async () => {
      const beforeManufacturerId = await ensureTestEngineManufacturerId(
        container,
        'UPD-BEFORE',
        'Before',
      )
      const afterManufacturerId = await ensureTestEngineManufacturerId(
        container,
        'UPD-AFTER',
        'After',
      )
      const created = await container.engineTypesRepository.create({
        code: 'UPD-TYPE',
        manufacturerId: beforeManufacturerId,
      })

      const updated = await container.engineTypesService.update(
        created.id,
        { manufacturerId: afterManufacturerId, notes: 'Updated notes' },
        {
          actorUserId: testUser(['settings.engine_types.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(updated.manufacturerName).toBe('After')

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows.some((row) => row.action === AuditAction.Update)).toBe(true)
    })

    it('emits resource_changed on update', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await createTestEngineType(scopedContainer, 'SSE-TYPE')

      await scopedContainer.engineTypesService.update(
        created.id,
        { notes: 'emit test' },
        {
          actorUserId: testUser(['settings.engine_types.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.EngineTypes },
      ])
    })

    it('reactivates engine type via PATCH isActive with audit log', async () => {
      const created = await createTestEngineType(container, 'REACT-TYPE')
      await container.engineTypesRepository.update(created.id, { isActive: false })

      const reactivated = await container.engineTypesService.update(
        created.id,
        { isActive: true },
        {
          actorUserId: testUser(['settings.engine_types.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(reactivated.isActive).toBe(true)
    })

    it('emits resource_changed on reactivation', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await createTestEngineType(scopedContainer, 'SSE-REACT')
      await scopedContainer.engineTypesRepository.update(created.id, { isActive: false })

      await scopedContainer.engineTypesService.update(
        created.id,
        { isActive: true },
        {
          actorUserId: testUser(['settings.engine_types.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.EngineTypes },
      ])
    })
  })

  describe('when deleting', () => {
    it('hard-deletes unused engine type with audit log', async () => {
      const created = await createTestEngineType(container, 'DEL-TYPE')

      await container.engineTypesService.hardDelete(created.id, {
        actorUserId: testUser(['settings.engine_types.manage']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      const found = await container.engineTypesRepository.findById(created.id)
      expect(found).toBeNull()

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows.some((row) => row.action === AuditAction.Delete)).toBe(true)
    })

    it('rejects hard delete when usageCount is greater than zero', async () => {
      const created = await createTestEngineType(container, 'USED-TYPE')
      await ctx.db
        .update(schema.engineTypes)
        .set({ usageCount: 1 })
        .where(eq(schema.engineTypes.id, created.id))

      await expect(
        container.engineTypesService.hardDelete(created.id, {
          actorUserId: testUser(['settings.engine_types.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        }),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('emits resource_changed on hard delete', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await createTestEngineType(scopedContainer, 'SSE-DEL')

      await scopedContainer.engineTypesService.hardDelete(created.id, {
        actorUserId: testUser(['settings.engine_types.manage']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.EngineTypes },
      ])
    })
  })

  describe('HTTP', () => {
    it('returns 403 on GET without any read permission', async () => {
      const app = createReferenceTestApp(container, testUser(['customers.view']))
      const res = await app.request('/api/engine-types')
      expect(res.status).toBe(403)
    })

    it('returns 403 on POST without create permission', async () => {
      const app = createReferenceTestApp(container, testUser(['emotive_claims.create']))
      const res = await app.request('/api/engine-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'HTTP-TEST' }),
      })
      expect(res.status).toBe(403)
    })

    it('creates engine type via POST', async () => {
      const manufacturerId = await ensureTestEngineManufacturerId(container, 'HTTP-BMW', 'BMW')
      const app = createReferenceTestApp(
        container,
        testUser(['settings.engine_types.create', 'emotive_claims.create']),
      )
      const res = await app.request('/api/engine-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'HTTP-N57', manufacturerId, displacementCc: 2998 }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as { code: string; usageCount: number }
      expect(body.code).toBe('HTTP-N57')
      expect(body.usageCount).toBe(0)
    })

    it('lists engine types with ANY read permission', async () => {
      await createTestEngineType(container, 'LIST-ONE')
      const app = createReferenceTestApp(container, testUser(['domace_claims.update']))
      const res = await app.request('/api/engine-types?limit=5')
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: unknown[]; hasMore: boolean }
      expect(body.items.length).toBeGreaterThan(0)
    })

    it('updates engine type via PATCH with manage permission', async () => {
      const beforeManufacturerId = await ensureTestEngineManufacturerId(
        container,
        'PATCH-BEFORE',
        'Patch Me',
      )
      const afterManufacturerId = await ensureTestEngineManufacturerId(
        container,
        'PATCH-AFTER',
        'Patched',
      )
      const created = await container.engineTypesRepository.create({
        code: 'PATCH-TYPE',
        manufacturerId: beforeManufacturerId,
      })
      const app = createReferenceTestApp(container, testUser(['settings.engine_types.manage']))
      const res = await app.request(`/api/engine-types/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturerId: afterManufacturerId, notes: 'SSE test note' }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { manufacturerName: string | null }
      expect(body.manufacturerName).toBe('Patched')
    })

    it('returns 403 on PATCH without manage permission', async () => {
      const created = await createTestEngineType(container, 'PATCH-FORBIDDEN')
      const app = createReferenceTestApp(container, testUser(['settings.engine_types.create']))
      const res = await app.request(`/api/engine-types/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Nope' }),
      })
      expect(res.status).toBe(403)
    })

    it('hard-deletes unused engine type via DELETE with manage permission', async () => {
      const created = await createTestEngineType(container, 'DELETE-TYPE')
      const app = createReferenceTestApp(container, testUser(['settings.engine_types.manage']))
      const res = await app.request(`/api/engine-types/${created.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(await container.engineTypesRepository.findById(created.id)).toBeNull()
    })

    it('returns 409 on DELETE when engine type is in use', async () => {
      const created = await createTestEngineType(container, 'DELETE-USED')
      await ctx.db
        .update(schema.engineTypes)
        .set({ usageCount: 2 })
        .where(eq(schema.engineTypes.id, created.id))

      const app = createReferenceTestApp(container, testUser(['settings.engine_types.manage']))
      const res = await app.request(`/api/engine-types/${created.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(409)
    })

    it('returns 401 without auth', async () => {
      const app = createReferenceTestApp(container, null)
      const res = await app.request('/api/engine-types')
      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Unauthorized)
    })
  })
})

describe('ExternalParties reference module', () => {
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

  it('creates external party with audit log via POST', async () => {
    const app = createReferenceTestApp(
      container,
      testUser(['settings.external_parties.create', 'emotive_claims.create']),
    )
    const res = await app.request('/api/external-parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Auto Delovi NS', kind: ExternalPartyKind.Supplier }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { name: string; kind: string; isActive: boolean }
    expect(body.name).toBe('Auto Delovi NS')
    expect(body.isActive).toBe(true)
  })
})

describe('Customers reference module', () => {
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

  describe('when listing', () => {
    it('filters by kind=emotive_partner', async () => {
      const app = createReferenceTestApp(container, testUser(['customers.view']))
      const res = await app.request(`/api/customers?kind=${CustomerKind.EmotivePartner}`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: Array<{ kind: string }> }
      expect(body.items.length).toBeGreaterThan(0)
      expect(body.items.every((item) => item.kind === CustomerKind.EmotivePartner)).toBe(true)
    })

    it('includes usageCount from emotive claims and customer user links', async () => {
      const created = await container.customersRepository.create({
        name: 'USAGE-COUNT-FIRMA',
        country: 'RS',
      })
      const engineTypeId = await createTestEngineType(container, 'USAGE-COUNT-ENG').then(
        (row) => row.id,
      )

      await ctx.db.insert(schema.emotiveClaims).values({
        warrantyReport: 'Usage count test',
        engineTypeId,
        dateOfClaim: new Date('2026-01-15'),
        mrNumber: 'MR-USAGE-COUNT',
        outcome: 'pending',
        claimYear: 2026,
        customerId: created.id,
        createdBy: TEST_USER_ID,
      })

      await ctx.db.insert(schema.customerUsers).values({
        customerId: created.id,
        userId: TEST_USER_ID,
        assignedBy: TEST_USER_ID,
      })

      // Search by this fixture's own name rather than paging: the integration database is
      // shared and rows survive across runs (docs/10 drift), so a bare `limit: 50` silently
      // stopped containing this row once the table passed 50 customers.
      const listed = await container.customersRepository.list({
        kind: CustomerKind.EmotivePartner,
        activeOnly: false,
        search: 'USAGE-COUNT-FIRMA',
        limit: 50,
      })

      const row = listed.items.find((item) => item.id === created.id)
      expect(row?.usageCount).toBe(2)
    })
  })

  describe('when creating', () => {
    it('creates emotive partner with defaults and writes audit log', async () => {
      const created = await container.customersService.create(
        { name: 'TEST-FIRMA', city: 'Beograd' },
        {
          actorUserId: testUser(['customers.create']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(created.name).toBe('TEST-FIRMA')
      expect(created.kind).toBe(CustomerKind.EmotivePartner)
      expect(created.city).toBe('Beograd')
      expect(created.isActive).toBe(true)
      expect(created.usageCount).toBe(0)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows).toHaveLength(1)
      expect(auditRows[0]?.action).toBe(AuditAction.Create)
      expect(auditRows[0]?.entityType).toBe('customer')
    })

    it('throws conflict for duplicate name within kind', async () => {
      await container.customersRepository.create({ name: 'DUP-FIRMA' })

      await expect(
        container.customersService.create(
          { name: 'DUP-FIRMA' },
          {
            actorUserId: testUser(['customers.create']).id,
            actorIp: null,
            actorUserAgent: null,
          },
        ),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('emits resource_changed on create', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)

      await scopedContainer.customersService.create(
        { name: 'SSE-FIRMA' },
        {
          actorUserId: testUser(['customers.create']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.Customers },
      ])
    })
  })

  describe('when updating', () => {
    it('updates fields with audit log', async () => {
      const created = await container.customersRepository.create({ name: 'UPD-FIRMA' })

      const updated = await container.customersService.update(
        created.id,
        { name: 'UPD-FIRMA-2', country: 'NL' },
        {
          actorUserId: testUser(['customers.update']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(updated.name).toBe('UPD-FIRMA-2')
      expect(updated.country).toBe('NL')

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows.some((row) => row.action === AuditAction.Update)).toBe(true)
    })

    it('reactivates customer via PATCH isActive', async () => {
      const created = await container.customersRepository.create({ name: 'REACT-FIRMA' })
      await container.customersRepository.update(created.id, { isActive: false })

      const reactivated = await container.customersService.update(
        created.id,
        { isActive: true },
        {
          actorUserId: testUser(['customers.update']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(reactivated.isActive).toBe(true)
    })

    it('emits resource_changed on update', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await scopedContainer.customersRepository.create({ name: 'SSE-UPD-FIRMA' })

      await scopedContainer.customersService.update(
        created.id,
        { city: 'Novi Sad' },
        {
          actorUserId: testUser(['customers.update']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.Customers },
      ])
    })
  })

  describe('when deleting', () => {
    it('hard-deletes unused customer with audit log', async () => {
      const created = await container.customersRepository.create({ name: 'DEL-FIRMA' })

      await container.customersService.hardDelete(created.id, {
        actorUserId: testUser(['customers.delete']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      const found = await container.customersRepository.findById(created.id)
      expect(found).toBeNull()

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows.some((row) => row.action === AuditAction.Delete)).toBe(true)
    })

    it('rejects hard delete when linked to emotive claims', async () => {
      const engineTypeId = await createTestEngineType(container, 'CUST-DEL-ENG').then(
        (row) => row.id,
      )
      const created = await container.customersRepository.create({ name: 'USED-FIRMA' })

      await ctx.db.insert(schema.emotiveClaims).values({
        warrantyReport: 'Test',
        engineTypeId,
        dateOfClaim: new Date('2026-01-15'),
        mrNumber: 'MR-CUST-DEL',
        outcome: 'pending',
        claimYear: 2026,
        customerId: created.id,
        createdBy: TEST_USER_ID,
      })

      await expect(
        container.customersService.hardDelete(created.id, {
          actorUserId: testUser(['customers.delete']).id,
          actorIp: null,
          actorUserAgent: null,
        }),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('rejects hard delete when linked to portal users', async () => {
      const created = await container.customersRepository.create({ name: 'LINKED-FIRMA' })

      await ctx.db.insert(schema.customerUsers).values({
        customerId: created.id,
        userId: TEST_USER_ID,
        assignedBy: TEST_USER_ID,
      })

      await expect(
        container.customersService.hardDelete(created.id, {
          actorUserId: testUser(['customers.delete']).id,
          actorIp: null,
          actorUserAgent: null,
        }),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('emits resource_changed on hard delete', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await scopedContainer.customersRepository.create({ name: 'SSE-DEL-FIRMA' })

      await scopedContainer.customersService.hardDelete(created.id, {
        actorUserId: testUser(['customers.delete']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.Customers },
      ])
    })
  })

  describe('HTTP', () => {
    it('returns 403 on POST without create permission', async () => {
      const app = createReferenceTestApp(container, testUser(['customers.view']))
      const res = await app.request('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'HTTP-FORBIDDEN' }),
      })
      expect(res.status).toBe(403)
    })

    it('creates customer via POST', async () => {
      const app = createReferenceTestApp(container, testUser(['customers.create']))
      const res = await app.request('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'HTTP-FIRMA', country: 'RS' }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as { name: string; kind: string; usageCount: number }
      expect(body.name).toBe('HTTP-FIRMA')
      expect(body.kind).toBe(CustomerKind.EmotivePartner)
      expect(body.usageCount).toBe(0)
    })

    it('updates customer via PATCH', async () => {
      const created = await container.customersRepository.create({ name: 'HTTP-PATCH-FIRMA' })
      const app = createReferenceTestApp(container, testUser(['customers.update']))
      const res = await app.request(`/api/customers/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { isActive: boolean }
      expect(body.isActive).toBe(false)
    })

    it('returns 403 on DELETE without delete permission', async () => {
      const created = await container.customersRepository.create({ name: 'HTTP-NO-DEL' })
      const app = createReferenceTestApp(container, testUser(['customers.update']))
      const res = await app.request(`/api/customers/${created.id}`, { method: 'DELETE' })
      expect(res.status).toBe(403)
    })

    it('hard-deletes customer via DELETE', async () => {
      const created = await container.customersRepository.create({ name: 'HTTP-DEL-FIRMA' })
      const app = createReferenceTestApp(container, testUser(['customers.delete']))
      const res = await app.request(`/api/customers/${created.id}`, { method: 'DELETE' })
      expect(res.status).toBe(204)
    })
  })
})

describe('ClaimSources reference module', () => {
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

  it('returns sources ordered by sortOrder with embedded defaultCustomer', async () => {
    const app = createReferenceTestApp(container, testUser(['emotive_claims.create']))
    const res = await app.request('/api/claim-sources?limit=50')
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      items: Array<{
        sortOrder: number
        defaultCustomer: { id: string; name: string } | null
      }>
    }

    expect(body.items.length).toBeGreaterThan(0)
    for (let index = 1; index < body.items.length; index++) {
      expect(body.items[index]!.sortOrder).toBeGreaterThanOrEqual(body.items[index - 1]!.sortOrder)
    }

    const withCustomer = body.items.find((item) => item.defaultCustomer !== null)
    expect(withCustomer?.defaultCustomer?.name.length).toBeGreaterThan(0)
  })
})

describe('Departments reference module', () => {
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

  it('lists departments for domace claim editors', async () => {
    const app = createReferenceTestApp(container, testUser(['domace_claims.update']))
    const res = await app.request('/api/departments?limit=50')
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      items: Array<{ code: string; sortOrder: number }>
    }

    expect(body.items.length).toBeGreaterThanOrEqual(10)
  })

  it('returns 403 without any claim edit permission', async () => {
    const app = createReferenceTestApp(container, testUser(['customers.view']))
    const res = await app.request('/api/departments')
    expect(res.status).toBe(403)
  })
})
