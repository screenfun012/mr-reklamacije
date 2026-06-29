import { schema } from '@mr/db'
import { AuditAction } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import {
  buildTestContainer,
  createReferenceTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const ACTOR = { actorUserId: TEST_USER_ID, actorIp: null, actorUserAgent: null }
const MANAGE = ['settings.departments.manage'] as const
const CLAIMS_ONLY = ['emotive_claims.create'] as const

async function seedEmployeeInDepartment(
  db: TestDbContext['db'],
  departmentId: string,
  normalizedName: string,
): Promise<void> {
  await db.insert(schema.employees).values({
    fullName: 'Usage Worker',
    normalizedName,
    departmentId,
    isActive: true,
  })
}

describe('Departments module', () => {
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

  describe('service CRUD', () => {
    it('creates a department with usageCount 0 and writes audit', async () => {
      const created = await container.departmentsService.create(
        { code: 'DEP-CREATE', nameSr: 'Montaža', nameEn: 'Assembly' },
        ACTOR,
      )

      expect(created.usageCount).toBe(0)
      expect(created.isActive).toBe(true)

      const audit = await ctx.db
        .select({ action: schema.auditLog.action })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))
      expect(audit.some((row) => row.action === AuditAction.Create)).toBe(true)
    })

    it('rejects a duplicate code with 409', async () => {
      await container.departmentsService.create(
        { code: 'DEP-DUP', nameSr: 'A', nameEn: 'A' },
        ACTOR,
      )

      await expect(
        container.departmentsService.create({ code: 'DEP-DUP', nameSr: 'B', nameEn: 'B' }, ACTOR),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('updates name and sort order', async () => {
      const created = await container.departmentsService.create(
        { code: 'DEP-UPD', nameSr: 'Staro', nameEn: 'Old' },
        ACTOR,
      )

      const updated = await container.departmentsService.update(
        created.id,
        { nameSr: 'Novo', sortOrder: 5 },
        ACTOR,
      )

      expect(updated.nameSr).toBe('Novo')
      expect(updated.sortOrder).toBe(5)
    })

    it('hard-deletes an unused department', async () => {
      const created = await container.departmentsService.create(
        { code: 'DEP-DEL', nameSr: 'Brisivo', nameEn: 'Deletable' },
        ACTOR,
      )

      await container.departmentsService.hardDelete(created.id, ACTOR)

      const found = await container.departmentsRepository.findById(created.id)
      expect(found).toBeNull()
    })
  })

  describe('usage-count protection', () => {
    it('blocks hard delete when an employee belongs to the department (409)', async () => {
      const created = await container.departmentsService.create(
        { code: 'DEP-USED', nameSr: 'Zauzeto', nameEn: 'Used' },
        ACTOR,
      )
      await seedEmployeeInDepartment(ctx.db, created.id, 'usage-worker-dep-used')

      const found = await container.departmentsRepository.findById(created.id)
      expect(found?.usageCount).toBeGreaterThan(0)

      await expect(
        container.departmentsService.hardDelete(created.id, ACTOR),
      ).rejects.toMatchObject({ status: 409 })
    })
  })

  describe('HTTP permissions (admin-only management)', () => {
    it('allows GET for internal claim editors', async () => {
      const app = createReferenceTestApp(container, testUser([...CLAIMS_ONLY], TEST_USER_ID))
      const response = await app.request('/api/departments')
      expect(response.status).toBe(200)
    })

    it('rejects POST without settings.departments.manage (403)', async () => {
      const app = createReferenceTestApp(container, testUser([...CLAIMS_ONLY], TEST_USER_ID))
      const response = await app.request('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'DEP-403', nameSr: 'X', nameEn: 'X' }),
      })
      expect(response.status).toBe(403)
    })

    it('allows POST with settings.departments.manage (201)', async () => {
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))
      const response = await app.request('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'DEP-201', nameSr: 'OK', nameEn: 'OK' }),
      })
      expect(response.status).toBe(201)
    })

    it('rejects DELETE without manage (403)', async () => {
      const created = await container.departmentsService.create(
        { code: 'DEP-DEL-403', nameSr: 'X', nameEn: 'X' },
        ACTOR,
      )
      const app = createReferenceTestApp(container, testUser([...CLAIMS_ONLY], TEST_USER_ID))
      const response = await app.request(`/api/departments/${created.id}`, { method: 'DELETE' })
      expect(response.status).toBe(403)
    })
  })
})
