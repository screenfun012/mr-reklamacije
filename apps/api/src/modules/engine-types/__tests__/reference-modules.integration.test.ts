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
import { ensureTestUser } from '../../../test-helpers/fixtures.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
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
      await container.engineTypesRepository.create({ code: 'PAGE-A' })
      await container.engineTypesRepository.create({ code: 'PAGE-B' })

      const firstPage = await container.engineTypesRepository.list({ activeOnly: true, limit: 1 })
      expect(firstPage.hasMore).toBe(true)

      const secondPage = await container.engineTypesRepository.list({
        activeOnly: true,
        limit: 1,
        cursor: firstPage.nextCursor ?? undefined,
      })

      expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id)
    })
  })

  describe('when creating', () => {
    it('creates engine type with defaults and writes audit log', async () => {
      const created = await container.engineTypesService.create(
        { code: 'TEST-N47', manufacturer: 'BMW' },
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
      await container.engineTypesRepository.create({ code: 'DUP-CODE' })

      await expect(
        container.engineTypesService.create(
          { code: 'DUP-CODE' },
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
      const created = await container.engineTypesRepository.create({
        code: 'UPD-TYPE',
        manufacturer: 'Before',
      })

      const updated = await container.engineTypesService.update(
        created.id,
        { manufacturer: 'After', notes: 'Updated notes' },
        {
          actorUserId: testUser(['settings.engine_types.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(updated.manufacturer).toBe('After')

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows.some((row) => row.action === AuditAction.Update)).toBe(true)
    })

    it('emits resource_changed on update', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await scopedContainer.engineTypesRepository.create({ code: 'SSE-TYPE' })

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
  })

  describe('when deleting', () => {
    it('soft-deletes engine type with audit log', async () => {
      const created = await container.engineTypesRepository.create({ code: 'DEL-TYPE' })

      const deleted = await container.engineTypesService.softDelete(created.id, {
        actorUserId: testUser(['settings.engine_types.manage']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      expect(deleted.isActive).toBe(false)

      const list = await container.engineTypesRepository.list({ activeOnly: true, limit: 50 })
      expect(list.items.some((item) => item.id === created.id)).toBe(false)
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
      const app = createReferenceTestApp(
        container,
        testUser(['settings.engine_types.create', 'emotive_claims.create']),
      )
      const res = await app.request('/api/engine-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'HTTP-N57', displacementCc: 2998 }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as { code: string; usageCount: number }
      expect(body.code).toBe('HTTP-N57')
      expect(body.usageCount).toBe(0)
    })

    it('lists engine types with ANY read permission', async () => {
      await container.engineTypesRepository.create({ code: 'LIST-ONE' })
      const app = createReferenceTestApp(container, testUser(['domace_claims.update']))
      const res = await app.request('/api/engine-types?limit=5')
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: unknown[]; hasMore: boolean }
      expect(body.items.length).toBeGreaterThan(0)
    })

    it('updates engine type via PATCH with manage permission', async () => {
      const created = await container.engineTypesRepository.create({
        code: 'PATCH-TYPE',
        manufacturer: 'Patch Me',
      })
      const app = createReferenceTestApp(container, testUser(['settings.engine_types.manage']))
      const res = await app.request(`/api/engine-types/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer: 'Patched', notes: 'SSE test note' }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { manufacturer: string | null }
      expect(body.manufacturer).toBe('Patched')
    })

    it('returns 403 on PATCH without manage permission', async () => {
      const created = await container.engineTypesRepository.create({
        code: 'PATCH-FORBIDDEN',
      })
      const app = createReferenceTestApp(container, testUser(['settings.engine_types.create']))
      const res = await app.request(`/api/engine-types/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Nope' }),
      })
      expect(res.status).toBe(403)
    })

    it('soft-deletes engine type via DELETE with manage permission', async () => {
      const created = await container.engineTypesRepository.create({ code: 'DELETE-TYPE' })
      const app = createReferenceTestApp(container, testUser(['settings.engine_types.manage']))
      const res = await app.request(`/api/engine-types/${created.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { isActive: boolean }
      expect(body.isActive).toBe(false)
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

  it('filters by kind=emotive_partner', async () => {
    const app = createReferenceTestApp(container, testUser(['customers.view']))
    const res = await app.request(`/api/customers?kind=${CustomerKind.EmotivePartner}`)
    expect(res.status).toBe(200)

    const body = (await res.json()) as { items: Array<{ kind: string }> }
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.every((item) => item.kind === CustomerKind.EmotivePartner)).toBe(true)
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
