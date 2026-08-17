import { PERMISSIONS } from '@mr/shared'
import { notInArray } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

/**
 * The catalog in code is the truth, so this seed also PRUNES: a permission removed from
 * `@mr/shared` is deleted here, together with the role rows that granted it.
 *
 * Without the prune, a retired permission lives on in the database forever and keeps being handed
 * out by whatever role held it — invisible, because nothing in the app names it any more. That is
 * how 13 dead entries survived to 2026-08-17.
 *
 * The role rows go first on purpose: `role_permissions.permission_id` is ON DELETE RESTRICT, so
 * deleting the permission alone would fail. Explicit, in this order, rather than a cascade —
 * a cascade on this table would also quietly erase grants whenever a permission is renamed.
 */
async function prunePermissions(db: NodePgDatabase<typeof schema>): Promise<void> {
  const known = [...PERMISSIONS]

  await db
    .delete(schema.rolePermissions)
    .where(notInArray(schema.rolePermissions.permissionId, known))

  const removed = await db
    .delete(schema.permissions)
    .where(notInArray(schema.permissions.id, known))
    .returning({ id: schema.permissions.id })

  if (removed.length > 0) {
    console.log(
      `[seed:permissions] Pruned ${removed.length} retired: ${removed.map((r) => r.id).join(', ')}`,
    )
  }
}

export async function seedPermissions(db: NodePgDatabase<typeof schema>): Promise<void> {
  const values = PERMISSIONS.map((code) => {
    const [module, ...actionParts] = code.split('.')
    const action = actionParts.join('.')
    return {
      id: code,
      module: module!,
      action,
      nameSr: code,
      nameEn: code,
      descriptionSr: '',
      descriptionEn: '',
    }
  })

  const inserted = await db
    .insert(schema.permissions)
    .values(values)
    .onConflictDoNothing({ target: schema.permissions.id })
    .returning({ id: schema.permissions.id })

  console.log(`[seed:permissions] Inserted ${inserted.length} / ${values.length} permissions`)

  await prunePermissions(db)
}
