import { PERMISSIONS } from '@mr/shared'
import { and, eq, isNull, notInArray, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'
import { PERMISSION_LABELS } from './permission-labels.js'

export interface SeedPermissionsOptions {
  /**
   * Lets the prune below delete grants that live roles still hold. Off by default: a seed that can
   * take somebody's access away has to be asked for. See `assertPruneIsAllowed`.
   */
  prune?: boolean
}

/**
 * Refuses a prune that would take an action away from somebody, unless the caller asked for it.
 *
 * The prune deletes by comparing the database against the catalog of the code that is RUNNING, and
 * there are two ordinary ways for that comparison to be wrong rather than stale:
 *
 * - **Rolled back to an older image.** Its catalog is smaller, so every permission added since
 *   looks retired and is deleted — grants on custom sets included.
 * - **A permission renamed.** The old id is not in the catalog any more, so it is pruned with all
 *   of its grants, and the new id arrives held by nobody. (`ON DELETE RESTRICT` does not catch
 *   this: the grants are deleted a statement earlier, by us.)
 *
 * Neither is distinguishable from a genuine retirement by looking at the data, so the seed stops
 * and shows a person the names instead of guessing. An orphan permission row that NO live set
 * grants is deleted without asking — nobody can lose what nobody holds, and that keeps the ordinary
 * seed flag-free.
 */
async function assertPruneIsAllowed(
  db: NodePgDatabase<typeof schema>,
  known: readonly string[],
  allowed: boolean,
): Promise<void> {
  if (allowed) {
    return
  }

  const endangered = await db
    .select({
      permissionId: schema.rolePermissions.permissionId,
      roleName: schema.roles.nameSr,
    })
    .from(schema.rolePermissions)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.rolePermissions.roleId))
    .where(
      and(
        notInArray(schema.rolePermissions.permissionId, [...known]),
        // A soft-deleted set cannot be restored and is on nobody's list, so its grants dying costs
        // nothing — counting it would block the seed over an access that does not exist.
        isNull(schema.roles.deletedAt),
      ),
    )

  if (endangered.length === 0) {
    return
  }

  const byPermission = new Map<string, string[]>()
  for (const row of endangered) {
    const roles = byPermission.get(row.permissionId) ?? []
    roles.push(row.roleName)
    byPermission.set(row.permissionId, roles)
  }

  const listing = [...byPermission.entries()]
    .map(([permissionId, roles]) => `  ${permissionId.padEnd(38)} → ${roles.join(', ')}`)
    .join('\n')

  throw new Error(
    `[seed:permissions] Refusing to prune: ${byPermission.size} permission(s) missing from this ` +
      `build's catalog are still granted to live roles. Deleting them removes those grants for good:\n\n` +
      `${listing}\n\n` +
      'Nothing has been written — the whole seed runs in one transaction.\n' +
      'If this list is the retirement you intended, re-run with:\n' +
      '  pnpm --filter @mr/db run db:seed -- --prune\n' +
      'If it is not, you are running an older build than the database expects. Deploy first.',
  )
}

/**
 * The catalog in code is the truth, so this seed also PRUNES: a permission removed from
 * `@mr/shared` is deleted here, together with the role rows that granted it.
 *
 * Without the prune, a retired permission lives on in the database forever and keeps being handed
 * out by whatever role held it — invisible, because nothing in the app names it any more. That is
 * how 13 dead entries survived to 2026-08-17.
 *
 * The role rows go first because `role_permissions.permission_id` is ON DELETE RESTRICT, so
 * deleting the permission alone would fail. Explicit rather than a cascade — a cascade would put
 * this deletion out of sight, and `assertPruneIsAllowed` above is the whole reason it must stay in
 * view.
 */
async function prunePermissions(
  db: NodePgDatabase<typeof schema>,
  allowed: boolean,
): Promise<void> {
  const known = [...PERMISSIONS]

  await assertPruneIsAllowed(db, known, allowed)

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

export async function seedPermissions(
  db: NodePgDatabase<typeof schema>,
  options: SeedPermissionsOptions = {},
): Promise<void> {
  const values = PERMISSIONS.map((code) => {
    const [module, ...actionParts] = code.split('.')
    const action = actionParts.join('.')
    const label = PERMISSION_LABELS[code]

    if (module === undefined) {
      throw new Error(`Permission code without a module: ${code}`)
    }

    return { id: code, module, action, ...label }
  })

  // Names are UPSERTED, not left alone. `onConflictDoNothing` would have frozen whatever the row
  // was first seeded with — and until 2026-08-18 that was the bare code, which is exactly what the
  // roles panel must never show. A reworded action now reaches every install on the next seed.
  const inserted = await db
    .insert(schema.permissions)
    .values(values)
    .onConflictDoUpdate({
      target: schema.permissions.id,
      set: {
        module: sql`excluded.module`,
        action: sql`excluded.action`,
        nameSr: sql`excluded.name_sr`,
        nameEn: sql`excluded.name_en`,
        descriptionSr: sql`excluded.description_sr`,
        descriptionEn: sql`excluded.description_en`,
      },
    })
    .returning({ id: schema.permissions.id })

  console.log(`[seed:permissions] Wrote ${inserted.length} / ${values.length} permissions`)

  await prunePermissions(db, options.prune ?? false)
}
