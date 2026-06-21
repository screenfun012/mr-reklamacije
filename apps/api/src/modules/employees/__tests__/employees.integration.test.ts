import { schema } from '@mr/db'
import { ERROR_CODE, normalizeName } from '@mr/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createReferenceTestApp,
  buildTestContainer,
  testUser,
} from '../../../test-helpers/test-app.js'
import { getDepartmentIdByCode } from '../../../test-helpers/fixtures.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { Container } from '../../../core/container.js'

describe('Employees reference module', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  describe('EmployeesRepository', () => {
    it('lists seeded employees excluding soft-deleted rows', async () => {
      await ctx.db.insert(schema.employees).values({
        fullName: 'Deleted Worker',
        normalizedName: normalizeName('Deleted Worker'),
        isActive: true,
        deletedAt: new Date(),
      })

      const result = await container.employeesRepository.list({ activeOnly: true, limit: 50 })

      expect(result.items.length).toBeGreaterThanOrEqual(24)
      expect(result.items.some((item) => item.full_name === 'Deleted Worker')).toBe(false)
    })

    it('filters by departmentId', async () => {
      const departmentId = await getDepartmentIdByCode(ctx.db, 'BLOKOVI')
      const result = await container.employeesRepository.list({
        activeOnly: true,
        limit: 50,
        departmentId,
      })

      expect(result.items.length).toBeGreaterThanOrEqual(2)
      expect(result.items.every((item) => item.department_id === departmentId)).toBe(true)
    })

    it('paginates with cursor', async () => {
      const firstPage = await container.employeesRepository.list({ activeOnly: true, limit: 2 })
      expect(firstPage.hasMore).toBe(true)
      expect(firstPage.nextCursor).not.toBeNull()

      const secondPage = await container.employeesRepository.list({
        activeOnly: true,
        limit: 2,
        cursor: firstPage.nextCursor ?? undefined,
      })

      expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id)
      expect(secondPage.items[0]?.id).not.toBe(firstPage.items[1]?.id)
    })
  })

  describe('EmployeesService', () => {
    it('delegates list to repository', async () => {
      const result = await container.employeesService.list({ activeOnly: true, limit: 5 })
      expect(result.items).toHaveLength(5)
      expect(result.hasMore).toBe(true)
    })
  })

  describe('Employees HTTP', () => {
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
          full_name: string
          is_active: boolean
          department_id: string | null
        }>
        nextCursor: string | null
        hasMore: boolean
      }

      expect(body.items).toHaveLength(5)
      expect(body.hasMore).toBe(true)
      expect(body.items[0]?.full_name.length).toBeGreaterThan(0)
    })

    it('filters by departmentId query param', async () => {
      const departmentId = await getDepartmentIdByCode(ctx.db, 'GLAVE')
      const app = createReferenceTestApp(container, testUser(['employees.view']))
      const res = await app.request(`/api/employees?departmentId=${departmentId}`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        items: Array<{ department_id: string | null }>
      }

      expect(body.items.every((item) => item.department_id === departmentId)).toBe(true)
    })
  })
})
