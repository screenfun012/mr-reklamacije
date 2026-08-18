import { SYSTEM_ROLE_OPERATOR } from '@mr/shared'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import * as schema from '../../schema/index.js'
import { runSystemSeeds } from '../../seed/run-system-seeds.js'
import { STANDARD_ROLES } from '../../seed/standard-roles.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

const RETIRED = 'retired_module.rollback_probe'

// `seedRoles` refuses a standard code that belongs to a set built in the panel, rather than taking
// it over — that is the throw this test needs to land AFTER the prune has already deleted.
// Staged by flipping an existing standard set to non-system: `roles.code` is uniquely indexed, so a
// second row with the same code cannot be inserted and would fail on the constraint instead.
const COLLIDING_CODE = STANDARD_ROLES[0]?.code ?? 'intake_field'

describe('runSystemSeeds (integration)', () => {
  let pool: ReturnType<typeof createPool>
  let db: NodePgDatabase<typeof schema>

  beforeEach(async () => {
    pool = createPool(getIntegrationDatabaseUrl())
    db = createDb(pool) as unknown as NodePgDatabase<typeof schema>
    await runSystemSeeds(db, { prune: true })
  })

  afterEach(async () => {
    // Unconditional: the shared test database is reused by every suite, and a standard set left
    // flipped to non-system would make the NEXT suite's seed refuse before its first assertion.
    await db
      .update(schema.roles)
      .set({ isSystem: true })
      .where(eq(schema.roles.code, COLLIDING_CODE))
    await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.permissionId, RETIRED))
    await db.delete(schema.permissions).where(eq(schema.permissions.id, RETIRED))
    await pool.end()
  })

  it('rolls the prune back when a later step refuses', async () => {
    // The order is the whole point: `seedPermissions` DELETES and `seedRoles` THROWS. Step by step
    // that leaves production with permissions gone, roles half-written, and the catalogs never
    // reached — a state nothing names and nothing repairs.
    const [operator] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, SYSTEM_ROLE_OPERATOR))
      .limit(1)

    if (operator === undefined) throw new Error('operator role missing — system seeds did not run')

    await db.insert(schema.permissions).values({
      id: RETIRED,
      module: 'retired_module',
      action: 'rollback_probe',
      nameSr: RETIRED,
      nameEn: RETIRED,
      descriptionSr: RETIRED,
      descriptionEn: RETIRED,
    })
    await db.insert(schema.rolePermissions).values({ roleId: operator.id, permissionId: RETIRED })

    await db
      .update(schema.roles)
      .set({ isSystem: false })
      .where(eq(schema.roles.code, COLLIDING_CODE))

    await expect(runSystemSeeds(db, { prune: true })).rejects.toThrow(/belongs to a set built/)

    // Survived the abort, so the prune never committed.
    const survivingPermission = await db
      .select()
      .from(schema.permissions)
      .where(eq(schema.permissions.id, RETIRED))
    const survivingGrant = await db
      .select()
      .from(schema.rolePermissions)
      .where(eq(schema.rolePermissions.permissionId, RETIRED))

    expect(survivingPermission).toHaveLength(1)
    expect(survivingGrant).toHaveLength(1)
  })
})
