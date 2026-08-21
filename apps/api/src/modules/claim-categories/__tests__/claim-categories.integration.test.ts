import { schema } from '@mr/db'
import { AuditAction, ERROR_CODE, ResourceChangedKey } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import {
  buildTestContainer,
  createReferenceTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

describe('ClaimCategories reference module', () => {
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
    it('excludes soft-deleted categories', async () => {
      await ctx.db.insert(schema.claimCategories).values({
        code: 'DELETED-CAT',
        name: 'Deleted Cat',
        sortOrder: 999,
        isActive: true,
        deletedAt: new Date(),
      })

      const result = await container.claimCategoriesRepository.list({
        activeOnly: true,
        limit: 50,
      })
      expect(result.items.some((item) => item.code === 'DELETED-CAT')).toBe(false)
    })

    it('orders by sortOrder', async () => {
      await container.claimCategoriesRepository.create({
        code: 'SORT-B',
        name: 'Sort B',
        sortOrder: 2000,
      })
      await container.claimCategoriesRepository.create({
        code: 'SORT-A',
        name: 'Sort A',
        sortOrder: 1000,
      })

      const result = await container.claimCategoriesRepository.list({
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

    it('includes usageCount summed across emotive AND domace claims', async () => {
      const created = await container.claimCategoriesRepository.create({
        code: 'USAGE-CAT',
        name: 'Usage Cat',
      })
      const manufacturerId = await container.engineManufacturersRepository
        .create({ code: 'USAGE-CAT-MFG', name: 'Usage Cat Mfg' })
        .then((row) => row.id)
      const engineTypeId = await container.engineTypesRepository
        .create({ code: 'USAGE-CAT-ENG', manufacturerId })
        .then((row) => row.id)

      await ctx.db.insert(schema.emotiveClaims).values({
        warrantyReport: 'Usage count test',
        engineTypeId,
        dateOfClaim: new Date('2026-01-15'),
        mrNumber: 'MR-USAGE-CAT',
        outcome: 'pending',
        claimYear: 2026,
        categoryId: created.id,
        createdBy: TEST_USER_ID,
      })

      await ctx.db.insert(schema.domaceClaims).values({
        outcome: 'pending',
        claimYear: 2026,
        categoryId: created.id,
        createdBy: TEST_USER_ID,
      })

      const found = await container.claimCategoriesRepository.findById(created.id)
      expect(found?.usageCount).toBe(2)
    })
  })

  describe('when creating', () => {
    it('creates category with defaults and writes audit log', async () => {
      const created = await container.claimCategoriesService.create(
        { code: 'CREATE-AUDIT-CAT', name: 'Remont motora', sortOrder: 15 },
        {
          actorUserId: testUser(['settings.claim_categories.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(created.code).toBe('CREATE-AUDIT-CAT')
      expect(created.name).toBe('Remont motora')
      expect(created.sortOrder).toBe(15)
      expect(created.isActive).toBe(true)
      expect(created.usageCount).toBe(0)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows).toHaveLength(1)
      expect(auditRows[0]?.action).toBe(AuditAction.Create)
      expect(auditRows[0]?.entityType).toBe('claim_category')
    })

    it('emits resource_changed on create', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)

      await scopedContainer.claimCategoriesService.create(
        { code: 'SSE-CREATE-CAT', name: 'SSE Create' },
        {
          actorUserId: testUser(['settings.claim_categories.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.ClaimCategories },
      ])
    })

    it('throws conflict for duplicate code', async () => {
      await container.claimCategoriesRepository.create({
        code: 'DUP-CAT',
        name: 'Duplicate',
      })

      await expect(
        container.claimCategoriesService.create(
          { code: 'DUP-CAT', name: 'Duplicate again' },
          {
            actorUserId: testUser(['settings.claim_categories.manage']).id,
            actorIp: null,
            actorUserAgent: null,
          },
        ),
      ).rejects.toMatchObject({ status: 409 })
    })
  })

  describe('when updating', () => {
    it('updates name and sortOrder with audit log', async () => {
      const created = await container.claimCategoriesRepository.create({
        code: 'UPD-CAT',
        name: 'Before',
        sortOrder: 10,
      })

      const updated = await container.claimCategoriesService.update(
        created.id,
        { name: 'After', sortOrder: 20 },
        {
          actorUserId: testUser(['settings.claim_categories.manage']).id,
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

    it('reactivates category via PATCH isActive with audit log', async () => {
      const created = await container.claimCategoriesRepository.create({
        code: 'REACT-CAT',
        name: 'Reactivate Me',
      })
      await container.claimCategoriesRepository.update(created.id, { isActive: false })

      const reactivated = await container.claimCategoriesService.update(
        created.id,
        { isActive: true },
        {
          actorUserId: testUser(['settings.claim_categories.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(reactivated.isActive).toBe(true)
    })

    it('emits resource_changed on reactivation', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await scopedContainer.claimCategoriesRepository.create({
        code: 'SSE-REACT-CAT',
        name: 'SSE Reactivate',
      })
      await scopedContainer.claimCategoriesRepository.update(created.id, { isActive: false })
      eventBus.resourceEvents.length = 0

      await scopedContainer.claimCategoriesService.update(
        created.id,
        { isActive: true },
        {
          actorUserId: testUser(['settings.claim_categories.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        },
      )

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.ClaimCategories },
      ])
    })
  })

  describe('when deleting', () => {
    it('hard-deletes category with audit log', async () => {
      const created = await container.claimCategoriesRepository.create({
        code: 'DEL-CAT',
        name: 'To Delete',
      })

      await container.claimCategoriesService.hardDelete(created.id, {
        actorUserId: testUser(['settings.claim_categories.manage']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      const found = await container.claimCategoriesRepository.findById(created.id)
      expect(found).toBeNull()

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))

      expect(auditRows.some((row) => row.action === AuditAction.Delete)).toBe(true)
    })

    it('rejects hard delete when usageCount is greater than zero', async () => {
      const created = await container.claimCategoriesRepository.create({
        code: 'USED-CAT',
        name: 'Used Cat',
      })
      const manufacturerId = await container.engineManufacturersRepository
        .create({ code: 'USED-CAT-MFG', name: 'Used Cat Mfg' })
        .then((row) => row.id)
      const engineTypeId = await container.engineTypesRepository
        .create({ code: 'USED-CAT-ENG', manufacturerId })
        .then((row) => row.id)

      await ctx.db.insert(schema.emotiveClaims).values({
        warrantyReport: 'Blocks delete',
        engineTypeId,
        dateOfClaim: new Date('2026-01-15'),
        mrNumber: 'MR-USED-CAT',
        outcome: 'pending',
        claimYear: 2026,
        categoryId: created.id,
        createdBy: TEST_USER_ID,
      })

      await expect(
        container.claimCategoriesService.hardDelete(created.id, {
          actorUserId: testUser(['settings.claim_categories.manage']).id,
          actorIp: null,
          actorUserAgent: null,
        }),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('emits resource_changed on hard delete', async () => {
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
      const created = await scopedContainer.claimCategoriesRepository.create({
        code: 'SSE-DEL-CAT',
        name: 'SSE Delete',
      })

      await scopedContainer.claimCategoriesService.hardDelete(created.id, {
        actorUserId: testUser(['settings.claim_categories.manage']).id,
        actorIp: null,
        actorUserAgent: null,
      })

      expect(eventBus.resourceEvents).toEqual([
        { type: 'resource_changed', resource: ResourceChangedKey.ClaimCategories },
      ])
    })
  })

  describe('deactivation carries a date', () => {
    const MANAGER = {
      actorUserId: testUser(['settings.claim_categories.manage']).id,
      actorIp: null,
      actorUserAgent: null,
    }

    it('stamps deactivated_at on switch-off, keeps the first date, and clears it on switch-on', async () => {
      const created = await container.claimCategoriesService.create(
        { code: 'DATED-CAT', name: 'Dated Cat' },
        MANAGER,
      )
      expect(created.deactivatedAt).toBeNull()

      const off = await container.claimCategoriesService.update(
        created.id,
        { isActive: false },
        MANAGER,
      )
      expect(off.deactivatedAt).not.toBeNull()

      const offAgain = await container.claimCategoriesService.update(
        created.id,
        { name: 'Dated Cat 2', isActive: false },
        MANAGER,
      )
      expect(offAgain.deactivatedAt).toBe(off.deactivatedAt)

      const on = await container.claimCategoriesService.update(
        created.id,
        { isActive: true },
        MANAGER,
      )
      expect(on.deactivatedAt).toBeNull()
    })
  })

  describe('HTTP', () => {
    it('lists the seeded categories to a user who may only view claims', async () => {
      // Migration 0045 ships four categories the meeting agreed on (REMONT_MOTORA,
      // MASINSKA_OBRADA, NOVI_DELOVI, AUTO_SERVIS) — this asserts against that
      // real migration data, not a fixture, per packages/db's own migration test.
      const app = createReferenceTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request('/api/claim-categories')
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: { code: string }[] }
      expect(body.items.map((item) => item.code)).toContain('MASINSKA_OBRADA')
    })

    it('lists them to someone who only reads statistics', async () => {
      // The statistics screen filters by category and by manufacturer, and its route loader
      // fetches both catalogues before it draws anything. Rights are handed out as small
      // packages that add up, so "Statistika" alone is a real account — and without this the
      // whole screen died on a 403 from a dropdown's data.
      const app = createReferenceTestApp(container, testUser(['statistics.view_emotive']))
      const res = await app.request('/api/claim-categories')

      expect(res.status).toBe(200)
    })

    it('returns 403 on GET without any read permission', async () => {
      const app = createReferenceTestApp(container, testUser(['customers.view']))
      const res = await app.request('/api/claim-categories')
      expect(res.status).toBe(403)
    })

    it('refuses to create a category to someone without settings.claim_categories.manage', async () => {
      const app = createReferenceTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request('/api/claim-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'BALANSIRANJE', name: 'Balansiranje' }),
      })

      expect(res.status).toBe(403)
    })

    it('creates category via POST', async () => {
      const app = createReferenceTestApp(container, testUser(['settings.claim_categories.manage']))
      const res = await app.request('/api/claim-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'HTTP-CAT', name: 'HTTP Cat', sortOrder: 45 }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        code: string
        name: string
        sortOrder: number
        usageCount: number
      }
      expect(body.code).toBe('HTTP-CAT')
      expect(body.name).toBe('HTTP Cat')
      expect(body.sortOrder).toBe(45)
      expect(body.usageCount).toBe(0)
    })

    it('updates category via PATCH with manage permission', async () => {
      const created = await container.claimCategoriesRepository.create({
        code: 'PATCH-CAT',
        name: 'Patch Me',
      })
      const app = createReferenceTestApp(container, testUser(['settings.claim_categories.manage']))
      const res = await app.request(`/api/claim-categories/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Patched Name' }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { name: string }
      expect(body.name).toBe('Patched Name')
    })

    it('returns 403 on PATCH without manage permission', async () => {
      const created = await container.claimCategoriesRepository.create({
        code: 'PATCH-FORBIDDEN-CAT',
        name: 'Forbidden',
      })
      const app = createReferenceTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request(`/api/claim-categories/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nope' }),
      })
      expect(res.status).toBe(403)
    })

    it('hard-deletes category via DELETE with manage permission', async () => {
      const created = await container.claimCategoriesRepository.create({
        code: 'DELETE-CAT-HTTP',
        name: 'Delete Me',
      })
      const app = createReferenceTestApp(container, testUser(['settings.claim_categories.manage']))
      const res = await app.request(`/api/claim-categories/${created.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')

      const found = await container.claimCategoriesRepository.findById(created.id)
      expect(found).toBeNull()
    })

    it('refuses to hard-delete a category a claim points at', async () => {
      const remontCategory = await container.claimCategoriesRepository.create({
        code: 'REMONT-CAT',
        name: 'Remont motora',
      })
      const manufacturerId = await container.engineManufacturersRepository
        .create({ code: 'REMONT-CAT-MFG', name: 'Remont Cat Mfg' })
        .then((row) => row.id)
      const engineTypeId = await container.engineTypesRepository
        .create({ code: 'REMONT-CAT-ENG', manufacturerId })
        .then((row) => row.id)

      await ctx.db.insert(schema.emotiveClaims).values({
        warrantyReport: 'Blocks HTTP delete',
        engineTypeId,
        dateOfClaim: new Date('2026-01-15'),
        mrNumber: 'MR-REMONT-CAT',
        outcome: 'pending',
        claimYear: 2026,
        categoryId: remontCategory.id,
        createdBy: TEST_USER_ID,
      })

      const app = createReferenceTestApp(container, testUser(['settings.claim_categories.manage']))
      const res = await app.request(`/api/claim-categories/${remontCategory.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(409)
    })

    it('returns 401 without auth', async () => {
      const app = createReferenceTestApp(container, null)
      const res = await app.request('/api/claim-categories')
      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Unauthorized)
    })
  })
})
