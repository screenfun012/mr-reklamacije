import { UserAccountStatus } from '@mr/shared'
import { and, desc, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetBefore } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { roles, userRoles, users } from './users.schema.js'
import type { UserListItem, UserListResponse, UsersListQuery } from './users.validators.js'

interface UserRow {
  id: string
  email: string
  name: string
  accountStatus: UserListItem['accountStatus']
  createdAt: Date
}

function mapUserRow(row: UserRow, roleCodes: readonly string[]): UserListItem {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    accountStatus: row.accountStatus,
    createdAt: row.createdAt,
    roles: [...roleCodes],
  }
}

export class UsersRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: UsersListQuery): Promise<UserListResponse> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(users.deletedAt)]

    if (query.accountStatus !== undefined) {
      conditions.push(eq(users.accountStatus, query.accountStatus))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!)
    }

    const keysetCondition = keysetBefore(users.createdAt, users.id, cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        accountStatus: users.accountStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.createdAt.getTime(),
      id: row.id,
    }))

    const roleCodesByUserId = await this.loadRoleCodesByUserIds(page.items.map((row) => row.id))

    return {
      items: page.items.map((row) => mapUserRow(row, roleCodesByUserId.get(row.id) ?? [])),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async findAccountStatusById(id: string): Promise<UserListItem | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        accountStatus: users.accountStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1)

    if (row === undefined) {
      return null
    }

    const roleCodesByUserId = await this.loadRoleCodesByUserIds([row.id])

    return mapUserRow(row, roleCodesByUserId.get(row.id) ?? [])
  }

  async updateAccountStatus(
    id: string,
    accountStatus: UserListItem['accountStatus'],
  ): Promise<UserListItem> {
    const [updated] = await this.db
      .update(users)
      .set({ accountStatus })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        accountStatus: users.accountStatus,
        createdAt: users.createdAt,
      })

    if (updated === undefined) {
      throw new NotFoundError('User', id)
    }

    const roleCodesByUserId = await this.loadRoleCodesByUserIds([updated.id])

    return mapUserRow(updated, roleCodesByUserId.get(updated.id) ?? [])
  }

  private async loadRoleCodesByUserIds(userIds: readonly string[]): Promise<Map<string, string[]>> {
    if (userIds.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select({
        userId: userRoles.userId,
        code: roles.code,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(inArray(userRoles.userId, [...userIds]), isNull(roles.deletedAt)))

    const roleCodesByUserId = new Map<string, string[]>()

    for (const row of rows) {
      const existing = roleCodesByUserId.get(row.userId) ?? []
      existing.push(row.code)
      roleCodesByUserId.set(row.userId, existing)
    }

    return roleCodesByUserId
  }
}
