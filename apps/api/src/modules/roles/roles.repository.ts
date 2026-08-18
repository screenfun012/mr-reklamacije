import type {
  Permission,
  PermissionCatalogItem,
  RoleCreateInput,
  RoleDetail,
  RoleListItem,
  RoleUpdateInput,
} from '@mr/shared'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { permissions, rolePermissions, roles, userRoles } from './roles.schema.js'

const userCount = sql<number>`(
  SELECT COUNT(*)::int FROM ${userRoles} WHERE ${userRoles.roleId} = ${roles.id}
)`

const permissionCount = sql<number>`(
  SELECT COUNT(*)::int FROM ${rolePermissions} WHERE ${rolePermissions.roleId} = ${roles.id}
)`

const listColumns = {
  id: roles.id,
  code: roles.code,
  nameSr: roles.nameSr,
  nameEn: roles.nameEn,
  description: roles.description,
  isSystem: roles.isSystem,
  userCount,
  permissionCount,
}

export class RolesRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(): Promise<RoleListItem[]> {
    return this.db
      .select(listColumns)
      .from(roles)
      .where(isNull(roles.deletedAt))
      .orderBy(asc(roles.isSystem), asc(roles.nameSr))
  }

  async findById(id: string): Promise<RoleDetail | null> {
    const [role] = await this.db
      .select(listColumns)
      .from(roles)
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
      .limit(1)

    if (role === undefined) return null

    const granted = await this.db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, id))

    return { ...role, permissions: granted.map((row) => row.permissionId as Permission) }
  }

  async findByCode(code: string): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, code))
      .limit(1)

    // Deliberately unfiltered by `deleted_at`: the code is unique across the whole table, so a
    // soft-deleted role still owns its code and a new one may not reuse it.
    return row ?? null
  }

  async findHolderIds(roleId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId))

    return rows.map((row) => row.userId)
  }

  async create(code: string, input: RoleCreateInput, actorUserId: string): Promise<{ id: string }> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(roles)
        .values({
          code,
          nameSr: input.nameSr,
          nameEn: input.nameEn,
          description: input.description ?? null,
          isSystem: false,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning({ id: roles.id })

      if (created === undefined) {
        throw new Error('Role insert returned no row')
      }

      if (input.permissions.length > 0) {
        await tx
          .insert(rolePermissions)
          .values(input.permissions.map((permissionId) => ({ roleId: created.id, permissionId })))
      }

      return created
    })
  }

  /** Name and the whole action set in ONE transaction — a half-applied set is a wrong answer. */
  async update(id: string, input: RoleUpdateInput, actorUserId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(roles)
        .set({
          ...(input.nameSr === undefined ? {} : { nameSr: input.nameSr }),
          ...(input.nameEn === undefined ? {} : { nameEn: input.nameEn }),
          ...(input.description === undefined ? {} : { description: input.description }),
          updatedBy: actorUserId,
        })
        .where(eq(roles.id, id))

      if (input.permissions === undefined) return

      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id))

      if (input.permissions.length > 0) {
        await tx
          .insert(rolePermissions)
          .values(input.permissions.map((permissionId) => ({ roleId: id, permissionId })))
      }
    })
  }

  async softDelete(id: string, actorUserId: string): Promise<void> {
    await this.db
      .update(roles)
      .set({ deletedAt: new Date(), updatedBy: actorUserId })
      .where(eq(roles.id, id))
  }

  /** The matrix the panel draws: every action, with the name a person can read. */
  async listPermissionCatalog(): Promise<PermissionCatalogItem[]> {
    const rows = await this.db
      .select({
        id: permissions.id,
        module: permissions.module,
        nameSr: permissions.nameSr,
        nameEn: permissions.nameEn,
        descriptionSr: permissions.descriptionSr,
        descriptionEn: permissions.descriptionEn,
      })
      .from(permissions)
      .orderBy(asc(permissions.module), asc(permissions.id))

    return rows.map((row) => ({ ...row, id: row.id as Permission }))
  }
}
