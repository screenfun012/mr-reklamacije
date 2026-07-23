import { schema } from '@mr/db'
import { AuditAction, ERROR_CODE, normalizeName } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createReferenceTestApp,
  buildTestContainer,
  testUser,
} from '../../../test-helpers/test-app.js'
import {
  ensureTestUser,
  getDepartmentIdByCode,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { Container } from '../../../core/container.js'

const ACTOR = { actorUserId: TEST_USER_ID, actorIp: null, actorUserAgent: null }
const MANAGE = ['employees.create', 'employees.update', 'employees.delete'] as const

describe('Employees module', () => {
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

  describe('EmployeesRepository (reference list)', () => {
    it('lists seeded employees excluding soft-deleted rows', async () => {
      await ctx.db.insert(schema.employees).values({
        fullName: 'Deleted Worker',
        normalizedName: normalizeName('Deleted Worker'),
        isActive: true,
        deletedAt: new Date(),
      })

      const result = await container.employeesRepository.list({
        activeOnly: true,
        assignableOnly: false,
        limit: 50,
      })

      expect(result.items.length).toBeGreaterThanOrEqual(24)
      expect(result.items.some((item) => item.fullName === 'Deleted Worker')).toBe(false)
    })

    it('filters by departmentId', async () => {
      const departmentId = await getDepartmentIdByCode(ctx.db, 'BLOKOVI')
      const result = await container.employeesRepository.list({
        activeOnly: true,
        assignableOnly: false,
        limit: 50,
        departmentId,
      })

      expect(result.items.length).toBeGreaterThanOrEqual(2)
      expect(result.items.every((item) => item.departmentId === departmentId)).toBe(true)
    })

    it('filters to workers of assigned-worker departments only', async () => {
      // SKLAPANJE is seeded with providesAssignedWorkers = true; it has employees.
      const assemblyId = await getDepartmentIdByCode(ctx.db, 'SKLAPANJE')
      const result = await container.employeesRepository.list({
        activeOnly: true,
        assignableOnly: true,
        limit: 50,
      })

      expect(result.items.length).toBeGreaterThan(0)
      expect(result.items.every((item) => item.departmentId === assemblyId)).toBe(true)
    })

    it('paginates with cursor', async () => {
      const firstPage = await container.employeesRepository.list({
        activeOnly: true,
        assignableOnly: false,
        limit: 2,
      })
      expect(firstPage.hasMore).toBe(true)
      expect(firstPage.nextCursor).not.toBeNull()

      const secondPage = await container.employeesRepository.list({
        activeOnly: true,
        assignableOnly: false,
        limit: 2,
        cursor: firstPage.nextCursor ?? undefined,
      })

      expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id)
      expect(secondPage.items[0]?.id).not.toBe(firstPage.items[1]?.id)
    })
  })

  describe('service CRUD (management)', () => {
    it('creates an employee with usageCount 0 and writes audit', async () => {
      const created = await container.employeesService.create({ fullName: 'Petar Petrović' }, ACTOR)

      expect(created.usageCount).toBe(0)
      expect(created.isActive).toBe(true)
      expect(created.fullName).toBe('Petar Petrović')
      expect(created.departmentName).toBeNull()

      const audit = await ctx.db
        .select({ action: schema.auditLog.action })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))
      expect(audit.some((row) => row.action === AuditAction.Create)).toBe(true)
    })

    it('rejects a duplicate name with 409', async () => {
      await container.employeesService.create({ fullName: 'Marko Marković' }, ACTOR)

      await expect(
        container.employeesService.create({ fullName: 'Marko Marković' }, ACTOR),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('joins the department name and updates department + active flag', async () => {
      const department = await container.departmentsService.create(
        { code: 'EMP-DEP', nameSr: 'Montaža', nameEn: 'Assembly' },
        ACTOR,
      )
      const created = await container.employeesService.create(
        { fullName: 'Jovan Jovanović' },
        ACTOR,
      )

      const updated = await container.employeesService.update(
        created.id,
        { departmentId: department.id, isActive: false },
        ACTOR,
      )

      expect(updated.departmentId).toBe(department.id)
      expect(updated.departmentName).toBe('Montaža')
      expect(updated.isActive).toBe(false)
    })

    it('hard-deletes an unused employee', async () => {
      const created = await container.employeesService.create(
        { fullName: 'Obrisivi Radnik' },
        ACTOR,
      )

      await container.employeesService.hardDelete(created.id, ACTOR)

      expect(await container.employeesRepository.findById(created.id)).toBeNull()
    })
  })

  describe('HTTP', () => {
    it('returns 401 without auth', async () => {
      const app = createReferenceTestApp(container, null)
      const res = await app.request('/api/employees')
      expect(res.status).toBe(401)
    })

    it('returns 403 without employees.view permission', async () => {
      const app = createReferenceTestApp(container, testUser(['customers.view']))
      const res = await app.request('/api/employees')
      expect(res.status).toBe(403)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)
    })

    it('returns seeded employees for authorized user', async () => {
      const app = createReferenceTestApp(container, testUser(['employees.view']))
      const res = await app.request('/api/employees?limit=5')
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        items: Array<{
          id: string
          fullName: string
          departmentId: string | null
          departmentName: string | null
          isActive: boolean
          usageCount: number
        }>
        nextCursor: string | null
        hasMore: boolean
      }

      expect(body.items).toHaveLength(5)
      expect(body.hasMore).toBe(true)
      expect(body.items[0]?.fullName.length).toBeGreaterThan(0)
    })

    it('filters by departmentId query param', async () => {
      const departmentId = await getDepartmentIdByCode(ctx.db, 'GLAVE')
      const app = createReferenceTestApp(container, testUser(['employees.view']))
      const res = await app.request(`/api/employees?departmentId=${departmentId}`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        items: Array<{ departmentId: string | null }>
      }

      expect(body.items.every((item) => item.departmentId === departmentId)).toBe(true)
    })

    it('rejects POST without employees.create (403)', async () => {
      const app = createReferenceTestApp(container, testUser(['employees.view']))
      const res = await app.request('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Ne Sme' }),
      })
      expect(res.status).toBe(403)
    })

    it('allows POST with employees.create (201)', async () => {
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))
      const res = await app.request('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Sme Da Kreira' }),
      })
      expect(res.status).toBe(201)
    })

    it('rejects DELETE without employees.delete (403)', async () => {
      const created = await container.employeesService.create({ fullName: 'Za Brisanje' }, ACTOR)
      const app = createReferenceTestApp(container, testUser(['employees.view']))
      const res = await app.request(`/api/employees/${created.id}`, { method: 'DELETE' })
      expect(res.status).toBe(403)
    })
  })
})
