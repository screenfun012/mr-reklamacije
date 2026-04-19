import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createDb, createPool, getDatabaseUrl } from '../../client.js'
import {
  auditLog,
  customerUsers,
  customers,
  departments,
  employees,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from '../../schema/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool: ReturnType<typeof createPool>
let db: ReturnType<typeof createDb>

beforeAll(async () => {
  pool = createPool(getDatabaseUrl())
  db = createDb(pool)

  await migrate(db, {
    migrationsFolder: resolve(__dirname, '../../../migrations'),
  })

  await db.execute(sql`
    TRUNCATE TABLE
      audit_log,
      customer_users,
      employees,
      user_roles,
      role_permissions,
      roles,
      customers,
      departments,
      users,
      permissions
    RESTART IDENTITY CASCADE
  `)
})

afterAll(async () => {
  await pool.end()
})

describe('schema (integration)', () => {
  it('inserts records in access control tables', async () => {
    await db.insert(permissions).values({
      id: 'test.permission',
      module: 'test',
      action: 'permission',
      nameSr: 'Test',
      nameEn: 'Test',
      descriptionSr: 'Opis',
      descriptionEn: 'Description',
    })

    const [role] = await db
      .insert(roles)
      .values({
        code: 'test_role',
        nameSr: 'Test',
        nameEn: 'Test',
        isSystem: false,
      })
      .returning()

    expect(role?.id).toBeDefined()

    const [user] = await db
      .insert(users)
      .values({
        email: 'test@example.com',
        name: 'Test User',
      })
      .returning()

    expect(user?.id).toBeDefined()

    await db.insert(rolePermissions).values({
      roleId: role!.id,
      permissionId: 'test.permission',
    })

    await db.insert(userRoles).values({
      userId: user!.id,
      roleId: role!.id,
      assignedBy: user!.id,
    })
  })

  it('inserts records in master data tables', async () => {
    const [customer] = await db
      .insert(customers)
      .values({
        kind: 'emotive_partner',
        name: 'Test Customer',
      })
      .returning()

    expect(customer?.id).toBeDefined()

    const [dept] = await db
      .insert(departments)
      .values({
        code: 'TEST_DEPT',
        nameSr: 'Test',
        nameEn: 'Test',
      })
      .returning()

    expect(dept?.id).toBeDefined()

    const [employee] = await db
      .insert(employees)
      .values({
        fullName: 'Test Employee',
        normalizedName: 'TEST EMPLOYEE',
      })
      .returning()

    expect(employee?.id).toBeDefined()
  })

  it('rejects invalid CustomerKind via CHECK constraint', async () => {
    await expect(
      db.insert(customers).values({
        kind: 'invalid_kind' as never,
        name: 'Bad Customer',
      }),
    ).rejects.toThrow()
  })

  it('rejects invalid AuditAction via CHECK constraint', async () => {
    const [user] = await db.select().from(users).limit(1)

    await expect(
      db.insert(auditLog).values({
        entityType: 'user',
        entityId: user!.id,
        action: 'invalid_action' as never,
        actorUserId: user!.id,
      }),
    ).rejects.toThrow()
  })

  it('enforces UNIQUE constraint on employees.normalized_name', async () => {
    await db.insert(employees).values({
      fullName: 'First Employee',
      normalizedName: 'UNIQUE TEST',
    })

    await expect(
      db.insert(employees).values({
        fullName: 'Second Employee',
        normalizedName: 'UNIQUE TEST',
      }),
    ).rejects.toThrow()
  })

  it('enforces FK on customer_users.customer_id', async () => {
    const [user] = await db.select().from(users).limit(1)
    const fakeCustomerId = '00000000-0000-0000-0000-000000000000'

    await expect(
      db.insert(customerUsers).values({
        customerId: fakeCustomerId,
        userId: user!.id,
        assignedBy: user!.id,
      }),
    ).rejects.toThrow()
  })

  it('inserts audit_log record', async () => {
    const [user] = await db.select().from(users).limit(1)

    const [entry] = await db
      .insert(auditLog)
      .values({
        entityType: 'user',
        entityId: user!.id,
        action: 'create',
        actorUserId: user!.id,
        changes: { name: { before: null, after: 'Test User' } },
      })
      .returning()

    expect(entry?.id).toBeDefined()
    expect(entry?.action).toBe('create')
  })
})
