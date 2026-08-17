import { SYSTEM_ROLE_OPERATOR } from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import * as schema from '../../schema/index.js'
import { seedPermissions } from '../../seed/permissions.js'
import { seedRoles } from '../../seed/roles.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

// Deliberately a code the catalog can never hold, so the assertion cannot go green by accident.
const RETIRED = 'retired_module.gone'
const LIVE = 'emotive_claims.view'

describe('seedPermissions prune (integration)', () => {
  let pool: ReturnType<typeof createPool>
  let db: NodePgDatabase<typeof schema>

  beforeEach(async () => {
    pool = createPool(getIntegrationDatabaseUrl())
    db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

    // Self-sufficient: seedRoles writes role_permissions (FK -> permissions), shared test DB.
    await seedPermissions(db)
    await seedRoles(db)
  })

  afterEach(async () => {
    await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.permissionId, RETIRED))
    await db.delete(schema.permissions).where(eq(schema.permissions.id, RETIRED))
    await pool.end()
  })

  it('deletes a permission the catalog dropped, together with the roles that held it', async () => {
    const [operator] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, SYSTEM_ROLE_OPERATOR))
      .limit(1)

    if (operator === undefined) throw new Error('operator role missing — seedRoles did not run')

    await db.insert(schema.permissions).values({
      id: RETIRED,
      module: 'retired_module',
      action: 'gone',
      nameSr: 'retired_module.gone',
      nameEn: 'retired_module.gone',
      descriptionSr: 'retired_module.gone',
      descriptionEn: 'retired_module.gone',
    })
    await db.insert(schema.rolePermissions).values({ roleId: operator.id, permissionId: RETIRED })

    await seedPermissions(db)

    const survivingPermission = await db
      .select()
      .from(schema.permissions)
      .where(eq(schema.permissions.id, RETIRED))
    const survivingGrant = await db
      .select()
      .from(schema.rolePermissions)
      .where(eq(schema.rolePermissions.permissionId, RETIRED))

    expect(survivingPermission).toHaveLength(0)
    expect(survivingGrant).toHaveLength(0)

    // ...and the prune is not a wipe: a live permission and its grant are untouched.
    const live = await db.select().from(schema.permissions).where(eq(schema.permissions.id, LIVE))
    const liveGrant = await db
      .select()
      .from(schema.rolePermissions)
      .where(
        and(
          eq(schema.rolePermissions.roleId, operator.id),
          eq(schema.rolePermissions.permissionId, LIVE),
        ),
      )

    expect(live).toHaveLength(1)
    expect(liveGrant).toHaveLength(1)
  })
})
