import { schema } from '@mr/db'
import { AuditAction, ERROR_CODE } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import {
  buildTestContainer,
  createReferenceTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { ensureTestUser } from '../../../test-helpers/fixtures.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

describe('EngineManufacturers reference module', () => {
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
      })

      const sortAIndex = result.items.findIndex((item) => item.code === 'SORT-A')
      const sortBIndex = result.items.findIndex((item) => item.code === 'SORT-B')
      expect(sortAIndex).toBeGreaterThanOrEqual(0)
      expect(sortBIndex).toBeGreaterThanOrEqual(0)
      expect(sortAIndex).toBeLessThan(sortBIndex)
    })
  })

  describe('when creating', () => {
    it('creates manufacturer with defaults and writes audit log', async () => {
      const created = await container.engineManufacturersService.create(
        { code: 'TEST-BMW', name: 'Test BMW', sortOrder: 15 },
        {
          actorUserId: testUser(['settings.engine_manufacturers.create']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(created.code).toBe('TEST-BMW')
      expect(created.name).toBe('Test BMW')
      expect(created.sortOrder).toBe(15)
      expect(created.isActive).toBe(true)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows).toHaveLength(1)
      expect(auditRows[0]?.action).toBe(AuditAction.Create)
      expect(auditRows[0]?.entityType).toBe('engine_manufacturer')
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
  })

  describe('when deleting', () => {
    it('soft-deletes manufacturer with audit log', async () => {
      const created = await container.engineManufacturersRepository.create({
        code: 'DEL-MFG',
        name: 'To Delete',
      })

      const deleted = await container.engineManufacturersService.softDelete(created.id, {
        actorUserId: testUser(['settings.engine_manufacturers.manage']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      expect(deleted.isActive).toBe(false)

      const list = await container.engineManufacturersRepository.list({
        activeOnly: true,
        limit: 50,
      })
      expect(list.items.some((item) => item.id === created.id)).toBe(false)
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
      const body = (await res.json()) as { code: string; name: string; sortOrder: number }
      expect(body.code).toBe('HTTP-SKODA')
      expect(body.name).toBe('Škoda')
      expect(body.sortOrder).toBe(45)
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

    it('soft-deletes manufacturer via DELETE with manage permission', async () => {
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

      expect(res.status).toBe(200)
      const body = (await res.json()) as { isActive: boolean }
      expect(body.isActive).toBe(false)
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
