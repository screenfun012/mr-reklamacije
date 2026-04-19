import { schema } from '@mr/db'
import type { Permission } from '@mr/shared'
import { ADMIN_PERMISSIONS, SYSTEM_ROLE_ADMIN } from '@mr/shared'
import { eq, inArray } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

/**
 * RBAC permission resolver (DB-backed).
 *
 * Rules (per docs/03-permissions.md, docs/05-auth-realtime.md):
 * - Admin users get ADMIN_PERMISSIONS (= full catalog) via hard-coded
 *   bypass — never relies on role_permissions rows for admin, so seed
 *   drift can't lock admins out.
 * - Non-admin users get union of role_permissions across their roles.
 * - Users with no roles get empty Set.
 */
export interface PermissionResolver {
  getEffectiveForUser(userId: string): Promise<Set<Permission>>
  hasPermission(userId: string, permission: Permission): Promise<boolean>
}

export function createPermissionResolver(
  db: NodePgDatabase<typeof schema>,
): PermissionResolver {
  async function getEffectiveForUser(userId: string): Promise<Set<Permission>> {
    const userRolesRows = await db
      .select({
        roleId: schema.roles.id,
        roleCode: schema.roles.code,
      })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(eq(schema.userRoles.userId, userId))

    const isAdmin = userRolesRows.some((r) => r.roleCode === SYSTEM_ROLE_ADMIN)
    if (isAdmin) {
      return new Set(ADMIN_PERMISSIONS)
    }

    if (userRolesRows.length === 0) {
      return new Set<Permission>()
    }

    const roleIds = userRolesRows.map((r) => r.roleId)

    const permissionRows = await db
      .select({ permissionId: schema.rolePermissions.permissionId })
      .from(schema.rolePermissions)
      .where(inArray(schema.rolePermissions.roleId, roleIds))

    return new Set(permissionRows.map((r) => r.permissionId as Permission))
  }

  async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
    const effective = await getEffectiveForUser(userId)
    return effective.has(permission)
  }

  return { getEffectiveForUser, hasPermission }
}
