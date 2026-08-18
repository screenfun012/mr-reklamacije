import { createDb, createPool, getIntegrationDatabaseUrl, schema } from '@mr/db'
import { ADMIN_PERMISSIONS, SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_OPERATOR } from '@mr/shared'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { eq, sql } from 'drizzle-orm'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createPermissionResolver } from '../../permissions.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool: ReturnType<typeof createPool>
let db: NodePgDatabase<typeof schema>
let resolver: ReturnType<typeof createPermissionResolver>

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  db = createDb(pool) as unknown as NodePgDatabase<typeof schema>
  resolver = createPermissionResolver(db)

  await migrate(db, {
    migrationsFolder: resolve(__dirname, '../../../../db/migrations'),
  })
})

afterAll(async () => {
  await pool?.end()
})

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      sessions,
      accounts,
      two_factor_secrets,
      verification_tokens,
      user_roles,
      role_permissions,
      users,
      roles,
      permissions
    RESTART IDENTITY CASCADE
  `)
})

describe('PermissionResolver (integration)', () => {
  it('returns empty set for user with no roles', async () => {
    const [user] = await db
      .insert(schema.users)
      .values({ email: 'noroles@test.com', name: 'No Roles' })
      .returning()

    const effective = await resolver.getEffectiveForUser(user!.id)

    expect(effective.size).toBe(0)
  })

  it('returns full ADMIN_PERMISSIONS set for admin user (hard-coded bypass)', async () => {
    const [user] = await db
      .insert(schema.users)
      .values({ email: 'admin@test.com', name: 'Admin' })
      .returning()

    const [adminRole] = await db
      .insert(schema.roles)
      .values({
        code: SYSTEM_ROLE_ADMIN,
        nameSr: 'Administrator',
        nameEn: 'Administrator',
        isSystem: true,
      })
      .returning()

    await db.insert(schema.userRoles).values({
      userId: user!.id,
      roleId: adminRole!.id,
      assignedBy: user!.id,
    })

    const effective = await resolver.getEffectiveForUser(user!.id)

    expect(effective.size).toBe(ADMIN_PERMISSIONS.length)
    expect(effective.has('emotive_claims.view')).toBe(true)

    const byCodes = await resolver.getEffectiveForRoleCodes([SYSTEM_ROLE_ADMIN])
    expect(byCodes.length).toBe(ADMIN_PERMISSIONS.length)
  })

  it('returns union of role_permissions for non-admin user', async () => {
    await db.insert(schema.permissions).values({
      id: 'emotive_claims.view',
      module: 'emotive_claims',
      action: 'view',
      nameSr: 'Pregled',
      nameEn: 'View',
      descriptionSr: '',
      descriptionEn: '',
    })

    const [user] = await db
      .insert(schema.users)
      .values({ email: 'operator@test.com', name: 'Operator' })
      .returning()

    const [opRole] = await db
      .insert(schema.roles)
      .values({
        code: SYSTEM_ROLE_OPERATOR,
        nameSr: 'Operater',
        nameEn: 'Operator',
        isSystem: true,
      })
      .returning()

    await db.insert(schema.rolePermissions).values({
      roleId: opRole!.id,
      permissionId: 'emotive_claims.view',
    })

    await db.insert(schema.userRoles).values({
      userId: user!.id,
      roleId: opRole!.id,
      assignedBy: user!.id,
    })

    const effective = await resolver.getEffectiveForUser(user!.id)

    expect(effective.size).toBe(1)
    expect(effective.has('emotive_claims.view')).toBe(true)

    const byCodes = await resolver.getEffectiveForRoleCodes([SYSTEM_ROLE_OPERATOR])
    expect(byCodes).toContain('emotive_claims.view')
    expect(byCodes.length).toBe(1)
  })

  it('hasPermission returns true for admin on any permission', async () => {
    const [user] = await db
      .insert(schema.users)
      .values({ email: 'admin2@test.com', name: 'Admin2' })
      .returning()

    const [adminRole] = await db
      .insert(schema.roles)
      .values({
        code: SYSTEM_ROLE_ADMIN,
        nameSr: 'Admin',
        nameEn: 'Admin',
        isSystem: true,
      })
      .returning()

    await db.insert(schema.userRoles).values({
      userId: user!.id,
      roleId: adminRole!.id,
      assignedBy: user!.id,
    })

    const result = await resolver.hasPermission(user!.id, 'emotive_claims.delete')

    expect(result).toBe(true)
  })

  it('hasPermission returns false for non-admin without that permission', async () => {
    const [user] = await db
      .insert(schema.users)
      .values({ email: 'viewer@test.com', name: 'Viewer' })
      .returning()

    const result = await resolver.hasPermission(user!.id, 'emotive_claims.delete')

    expect(result).toBe(false)
  })

  it('stops granting anything the moment its set is deleted', async () => {
    // The panel deletes softly. Until 2026-08-18 neither query filtered `deleted_at`, so a deleted
    // set kept answering for everyone still carrying its code — harmless only because nothing could
    // delete a set. The panel is exactly what changes that.
    const [user] = await db
      .insert(schema.users)
      .values({ email: 'deleted-role@test.com', name: 'Holder' })
      .returning()

    await db.insert(schema.permissions).values({
      id: 'emotive_claims.view',
      module: 'emotive_claims',
      action: 'view',
      nameSr: 'Vidi',
      nameEn: 'Sees',
      descriptionSr: '',
      descriptionEn: '',
    })

    const [role] = await db
      .insert(schema.roles)
      .values({ code: 'privremeno', nameSr: 'Privremeno', nameEn: 'Temporary' })
      .returning()

    await db
      .insert(schema.rolePermissions)
      .values({ roleId: role!.id, permissionId: 'emotive_claims.view' })
    await db
      .insert(schema.userRoles)
      .values({ userId: user!.id, roleId: role!.id, assignedBy: user!.id })

    expect(await resolver.hasPermission(user!.id, 'emotive_claims.view')).toBe(true)

    await db
      .update(schema.roles)
      .set({ deletedAt: new Date() })
      .where(eq(schema.roles.id, role!.id))

    expect(await resolver.hasPermission(user!.id, 'emotive_claims.view')).toBe(false)
    // Also by code, which is the path a live session takes.
    expect(await resolver.getEffectiveForRoleCodes(['privremeno'])).toEqual([])
  })
})
