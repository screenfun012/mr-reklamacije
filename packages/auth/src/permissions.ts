import { schema } from '@mr/db'
import type { Permission } from '@mr/shared'
import { ADMIN_PERMISSIONS, SYSTEM_ROLE_ADMIN } from '@mr/shared'
import { and, eq, inArray, isNull } from 'drizzle-orm'
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
  /**
   * Effective permissions for the given role codes (session enrichment fast path).
   * Same semantics as resolving via user_roles for a user carrying these roles only.
   */
  getEffectiveForRoleCodes(roleCodes: readonly string[]): Promise<readonly Permission[]>
}

export function createPermissionResolver(db: NodePgDatabase<typeof schema>): PermissionResolver {
  async function getEffectiveForRoleCodes(
    roleCodes: readonly string[],
  ): Promise<readonly Permission[]> {
    const distinctCodes = [...new Set(roleCodes)]
    if (distinctCodes.includes(SYSTEM_ROLE_ADMIN)) {
      return [...ADMIN_PERMISSIONS]
    }
    if (distinctCodes.length === 0) {
      return []
    }

    // ⚠ `deleted_at IS NULL` is load-bearing, not tidiness: without it a set deleted in the panel
    // keeps handing out its actions to everyone still carrying its code in a live session.
    const roleRows = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(and(inArray(schema.roles.code, distinctCodes), isNull(schema.roles.deletedAt)))

    if (roleRows.length === 0) {
      return []
    }

    const roleIds = roleRows.map((r) => r.id)
    const permissionRows = await db
      .select({ permissionId: schema.rolePermissions.permissionId })
      .from(schema.rolePermissions)
      .where(inArray(schema.rolePermissions.roleId, roleIds))

    const unique = new Set(permissionRows.map((r) => r.permissionId as Permission))
    return [...unique]
  }

  async function getEffectiveForUser(userId: string): Promise<Set<Permission>> {
    const codes = await db
      .select({ code: schema.roles.code })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(and(eq(schema.userRoles.userId, userId), isNull(schema.roles.deletedAt)))

    const effective = await getEffectiveForRoleCodes(codes.map((r) => r.code))
    return new Set(effective)
  }

  async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
    const effective = await getEffectiveForUser(userId)
    return effective.has(permission)
  }

  return { getEffectiveForUser, hasPermission, getEffectiveForRoleCodes }
}
