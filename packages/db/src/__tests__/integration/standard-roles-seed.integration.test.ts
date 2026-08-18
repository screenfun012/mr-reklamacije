import { eq, inArray } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import * as schema from '../../schema/index.js'
import { seedPermissions } from '../../seed/permissions.js'
import { seedRoles } from '../../seed/roles.js'
import { STANDARD_ROLES } from '../../seed/standard-roles.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

/** A set the panel owns and the seed must never touch. */
const CUSTOM_CODE = 'test_custom_set'

/** A code one of the standard sets also uses — the collision the seed must refuse. */
const CLASHING_CODE = 'audit_view'

async function dropRoleByCode(db: NodePgDatabase<typeof schema>, code: string): Promise<void> {
  const rows = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.code, code))

  for (const row of rows) {
    await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, row.id))
    await db.delete(schema.roles).where(eq(schema.roles.id, row.id))
  }
}

async function permissionsOf(db: NodePgDatabase<typeof schema>, code: string): Promise<string[]> {
  const rows = await db
    .select({ permissionId: schema.rolePermissions.permissionId })
    .from(schema.rolePermissions)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.rolePermissions.roleId))
    .where(eq(schema.roles.code, code))

  return rows.map((row) => row.permissionId).sort()
}

describe('the standard privilege sets (integration)', () => {
  let pool: ReturnType<typeof createPool>
  let db: NodePgDatabase<typeof schema>

  beforeEach(async () => {
    pool = createPool(getIntegrationDatabaseUrl())
    db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

    // Self-sufficient on a shared test database: role_permissions has an FK to permissions.
    await seedPermissions(db)
    await seedRoles(db)
  })

  afterEach(async () => {
    const [custom] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, CUSTOM_CODE))
      .limit(1)

    if (custom !== undefined) {
      await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, custom.id))
      await db.delete(schema.roles).where(eq(schema.roles.id, custom.id))
    }

    await dropRoleByCode(db, CLASHING_CODE)
    await seedRoles(db)

    await pool.end()
  })

  it('seeds the office set with exactly the three actions the office holds', async () => {
    expect(await permissionsOf(db, 'intake_office')).toEqual([
      'intake_orders.change_status',
      'intake_orders.delete',
      'intake_orders.view',
    ])
  })

  it('marks every standard set built-in, so the panel offers copying instead of editing', async () => {
    const rows = await db
      .select({ code: schema.roles.code, isSystem: schema.roles.isSystem })
      .from(schema.roles)
      .where(
        inArray(
          schema.roles.code,
          STANDARD_ROLES.map((role) => role.code),
        ),
      )

    expect(rows).toHaveLength(STANDARD_ROLES.length)
    expect(rows.filter((row) => !row.isSystem)).toEqual([])
  })

  /**
   * The point of "the seed maintains them": a standard set is what the code says it is, so an
   * action added to one reaches every install on the next seed — and one nobody granted in code
   * goes away again. Add-only would let a hand-edited database keep handing out an action that no
   * longer appears anywhere a reader could find it.
   */
  it('takes back an action that code never granted a standard set', async () => {
    const [office] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, 'intake_office'))
      .limit(1)

    if (office === undefined) throw new Error('intake_office missing — seedRoles did not run')

    await db
      .insert(schema.rolePermissions)
      .values({ roleId: office.id, permissionId: 'audit.view' })

    await seedRoles(db)

    expect(await permissionsOf(db, 'intake_office')).not.toContain('audit.view')
  })

  /**
   * The other half of the same rule, and the one that would hurt: sets Nikola composed in the panel
   * are his. A seed that synced them too would silently undo his work on every deploy.
   */
  it('leaves a set built in the panel exactly as its author left it', async () => {
    const [custom] = await db
      .insert(schema.roles)
      .values({
        code: CUSTOM_CODE,
        nameSr: 'Probno ovlašćenje',
        nameEn: 'Test privilege',
        isSystem: false,
      })
      .returning({ id: schema.roles.id })

    if (custom === undefined) throw new Error('could not create the custom set')

    await db
      .insert(schema.rolePermissions)
      .values({ roleId: custom.id, permissionId: 'audit.view' })

    await seedRoles(db)

    expect(await permissionsOf(db, CUSTOM_CODE)).toEqual(['audit.view'])
  })
  /**
   * The trap this seed walks into on its own: `roles.code` is unique and the upsert targets it, so
   * a set the panel owns whose code happens to match a standard one would be RENAMED, flipped to
   * `is_system` and have its actions replaced — and its author could then neither edit nor delete
   * it, because system sets are read-only.
   *
   * Reachable in exactly one way, and it is the way that matters: a custom set made BEFORE the
   * standard set with that code existed. `freeCodeFor` protects the other direction (a set made
   * today cannot take a code already seeded), so nothing warns you and nothing gets in the way.
   *
   * A conflict over identity is a decision for a person, so the seed stops instead of guessing.
   */
  it('refuses to swallow a set the panel owns, rather than renaming it', async () => {
    await dropRoleByCode(db, CLASHING_CODE)

    const [custom] = await db
      .insert(schema.roles)
      .values({
        code: CLASHING_CODE,
        nameSr: 'Nikolino ovlašćenje',
        nameEn: 'Nikola custom',
        isSystem: false,
      })
      .returning({ id: schema.roles.id })

    if (custom === undefined) throw new Error('could not create the clashing set')
    await db
      .insert(schema.rolePermissions)
      .values({ roleId: custom.id, permissionId: 'users.view' })

    await expect(seedRoles(db)).rejects.toThrow(CLASHING_CODE)

    const [after] = await db.select().from(schema.roles).where(eq(schema.roles.id, custom.id))
    expect(after?.nameSr).toBe('Nikolino ovlašćenje')
    expect(after?.isSystem).toBe(false)
    expect(await permissionsOf(db, CLASHING_CODE)).toEqual(['users.view'])
  })

  /**
   * The other side of that refusal, and it has to be the other side or the guard becomes a trap:
   * a set that was DELETED still occupies its code (the unique index is not partial), and a deleted
   * set is not on the panel's list — so if the seed refused for it too, nobody could rename it and
   * `db:seed` would fail on every deploy from then on, with no way out through the app.
   *
   * Nothing is lost by taking the row: deleting a set is only possible when nobody holds it.
   */
  it('takes over a code left behind by a deleted set, which nobody can rename any more', async () => {
    await dropRoleByCode(db, CLASHING_CODE)

    const [gone] = await db
      .insert(schema.roles)
      .values({
        code: CLASHING_CODE,
        nameSr: 'Obrisano ovlašćenje',
        nameEn: 'Deleted privilege',
        isSystem: false,
        deletedAt: new Date(),
      })
      .returning({ id: schema.roles.id })

    if (gone === undefined) throw new Error('could not create the deleted set')

    await seedRoles(db)

    const [after] = await db.select().from(schema.roles).where(eq(schema.roles.id, gone.id))
    expect(after?.isSystem).toBe(true)
    expect(after?.deletedAt).toBeNull()
    expect(await permissionsOf(db, CLASHING_CODE)).toEqual(['audit.view'])
  })
})
