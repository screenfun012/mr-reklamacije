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
})
