import {
  ADMIN_PERMISSIONS,
  CLIENT_PERMISSIONS,
  OPERATOR_PERMISSIONS,
  SERVISER_PERMISSIONS,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_SERVISER,
  SYSTEM_ROLE_VIEWER,
  VIEWER_PERMISSIONS,
} from '@mr/shared'
import { and, eq, isNull, notInArray, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'
import { STANDARD_ROLES, type StandardRoleSeed } from './standard-roles.js'

/**
 * The five coarse roles that predate the panel. They stay: `admin` and `client` are load-bearing
 * (the resolver hands `admin` every action from code, and `client` is only ever assigned through
 * approval, together with a firm), and the other three are what people hold today.
 */
const LEGACY_ROLES: readonly StandardRoleSeed[] = [
  {
    code: SYSTEM_ROLE_ADMIN,
    nameSr: 'Administrator',
    nameEn: 'Administrator',
    permissions: ADMIN_PERMISSIONS,
  },
  {
    code: SYSTEM_ROLE_OPERATOR,
    nameSr: 'Operater',
    nameEn: 'Operator',
    permissions: OPERATOR_PERMISSIONS,
  },
  {
    code: SYSTEM_ROLE_VIEWER,
    nameSr: 'Pregled',
    nameEn: 'Viewer',
    permissions: VIEWER_PERMISSIONS,
  },
  {
    code: SYSTEM_ROLE_SERVISER,
    nameSr: 'Serviser',
    nameEn: 'Service technician',
    permissions: SERVISER_PERMISSIONS,
  },
  {
    code: SYSTEM_ROLE_CLIENT,
    nameSr: 'Klijent',
    nameEn: 'Client',
    permissions: CLIENT_PERMISSIONS,
  },
]

const SYSTEM_ROLES: readonly StandardRoleSeed[] = [...LEGACY_ROLES, ...STANDARD_ROLES]

/**
 * Makes the set's actions equal to what the code says — inserting what is missing and **removing
 * what code never granted**.
 *
 * Add-only was the old behaviour and it cannot express a set: an action taken out of a package here
 * would keep being handed out by every database that had already seen it, invisibly, because
 * nothing in the repository would name it any more. Only `is_system` rows go through this; a set
 * composed in the panel belongs to its author and the seed must never reach into it.
 */
async function syncRolePermissions(
  db: NodePgDatabase<typeof schema>,
  roleId: string,
  permissions: readonly string[],
): Promise<number> {
  await db.delete(schema.rolePermissions).where(
    and(
      eq(schema.rolePermissions.roleId, roleId),
      // An empty package would mean "no actions", so the guard keeps `notInArray` from turning
      // that into "delete nothing" — the one case where the two differ.
      permissions.length > 0
        ? notInArray(schema.rolePermissions.permissionId, [...permissions])
        : undefined,
    ),
  )

  if (permissions.length === 0) {
    return 0
  }

  const inserted = await db
    .insert(schema.rolePermissions)
    .values(permissions.map((permissionId) => ({ roleId, permissionId })))
    .onConflictDoNothing({
      target: [schema.rolePermissions.roleId, schema.rolePermissions.permissionId],
    })
    .returning({ permissionId: schema.rolePermissions.permissionId })

  return inserted.length
}

/**
 * Stops the seed from taking a code that belongs to somebody's own set.
 *
 * `roles.code` is unique and the upsert below targets it, so without this a custom set whose code
 * happens to match a standard one is RENAMED, flipped to `is_system` and has its actions replaced —
 * and its author can then neither edit nor delete it, because a system set is read-only. Silent,
 * and on the next deploy after the standard set is introduced.
 *
 * Only one direction is reachable: a set made BEFORE the standard set with that code existed.
 * `RolesService.freeCodeFor` already prevents the other one. Which is exactly why it needs a guard —
 * nothing in the app would warn you, and the seed would look like it worked.
 *
 * It throws rather than skipping: a collision over identity is a decision for a person (rename the
 * custom set, then seed again), and a seed that quietly diverges from the code is the thing this
 * whole file exists to prevent.
 */
async function assertCodeIsFree(db: NodePgDatabase<typeof schema>, code: string): Promise<void> {
  const [existing] = await db
    .select({ isSystem: schema.roles.isSystem, nameSr: schema.roles.nameSr })
    .from(schema.roles)
    // ⚠ Live sets only. A DELETED set still occupies its code — the unique index is not partial —
    // and a deleted set is not on the panel's list, so refusing for it would make `db:seed` fail on
    // every deploy from then on with no way to rename it through the app. Taking that row costs
    // nothing: a set can only be deleted when nobody holds it.
    .where(and(eq(schema.roles.code, code), isNull(schema.roles.deletedAt)))
    .limit(1)

  if (existing !== undefined && !existing.isSystem) {
    throw new Error(
      `[seed:roles] The code "${code}" belongs to a set built in the panel ("${existing.nameSr}"). ` +
        'Seeding would rename it and take it over. Rename that set in the admin panel, then run the seed again.',
    )
  }
}

export async function seedRoles(db: NodePgDatabase<typeof schema>): Promise<void> {
  let rolesInserted = 0
  let junctionsInserted = 0

  for (const roleSeed of SYSTEM_ROLES) {
    await assertCodeIsFree(db, roleSeed.code)

    // Names are written over, for the same reason permission labels are: a reworded package has to
    // reach an install that already has the row, and nobody can edit these from the panel anyway.
    // `deleted_at` is cleared with them: the seed's promise is that a standard set IS what the code
    // says, and a hand-deleted row that stays hidden would break that quietly.
    const insertedRows = await db
      .insert(schema.roles)
      .values({
        code: roleSeed.code,
        nameSr: roleSeed.nameSr,
        nameEn: roleSeed.nameEn,
        isSystem: true,
      })
      .onConflictDoUpdate({
        target: schema.roles.code,
        set: {
          nameSr: sql`excluded.name_sr`,
          nameEn: sql`excluded.name_en`,
          isSystem: sql`excluded.is_system`,
          deletedAt: sql`NULL`,
        },
      })
      .returning({ id: schema.roles.id, createdAt: schema.roles.createdAt })

    const [role] = insertedRows

    if (!role) {
      throw new Error(`[seed:roles] Role ${roleSeed.code} not found after upsert`)
    }

    rolesInserted += 1
    junctionsInserted += await syncRolePermissions(db, role.id, roleSeed.permissions)
  }

  console.log(
    `[seed:roles] Wrote ${String(rolesInserted)} / ${String(SYSTEM_ROLES.length)} roles, ${String(junctionsInserted)} new role_permissions`,
  )
}
