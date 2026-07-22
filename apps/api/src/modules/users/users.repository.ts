import { CustomerKind, SYSTEM_ROLE_CLIENT, UserAccountStatus } from '@mr/shared'
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { NotFoundError, ValidationError } from '../../core/errors/domain-errors.js'
import type { ActivatableUser } from '../../core/ports/client-activation-port.js'
import {
  buildPaginatedSlice,
  parseOptionalKeysetCursor,
  type KeysetCursor,
} from '../../core/utils/pagination.js'
import { customers, customerUsers, roles, userRoles, users } from './users.schema.js'
import type { UserListItem, UserListResponse, UsersListQuery } from './users.validators.js'

/**
 * Exact created_at as Postgres text — the keyset cursor value. Comparing text
 * back via `::timestamptz` keeps full microsecond precision; a JS
 * `Date.getTime()` cursor would emit `timestamptz < bigint`, which Postgres
 * rejects (same pattern as audit-log.repository.ts).
 */
const createdAtCursorSql = sql<string>`${users.createdAt}::text`

/** Keyset condition for ORDER BY created_at DESC, id DESC at full timestamp precision. */
function keysetBeforeUsers(cursor: KeysetCursor | null): SQL | undefined {
  if (cursor === null) {
    return undefined
  }

  const primary = String(cursor.primary)
  return sql`(${users.createdAt} < ${primary}::timestamptz OR (${users.createdAt} = ${primary}::timestamptz AND ${users.id} < ${cursor.id}))`
}

interface UserRow {
  id: string
  email: string
  name: string
  accountStatus: UserListItem['accountStatus']
  createdAt: Date
  requestedCompany: string | null
  isActive: boolean
}

function mapUserRow(row: UserRow, roleCodes: readonly string[]): UserListItem {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    accountStatus: row.accountStatus,
    createdAt: row.createdAt.toISOString(),
    roles: [...roleCodes],
    requestedCompany: row.requestedCompany,
    isActive: row.isActive,
  }
}

const userListColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  accountStatus: users.accountStatus,
  createdAt: users.createdAt,
  requestedCompany: users.requestedCompany,
  isActive: users.isActive,
} as const

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

    const keysetCondition = keysetBeforeUsers(cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({ ...userListColumns, createdAtText: createdAtCursorSql })
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.createdAtText,
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
      .select(userListColumns)
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1)

    if (row === undefined) {
      return null
    }

    const roleCodesByUserId = await this.loadRoleCodesByUserIds([row.id])

    return mapUserRow(row, roleCodesByUserId.get(row.id) ?? [])
  }

  async findActivationUserById(id: string): Promise<ActivatableUser | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        preferredLanguage: users.preferredLanguage,
      })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1)

    return row ?? null
  }

  async updateAccountStatus(
    id: string,
    accountStatus: UserListItem['accountStatus'],
  ): Promise<UserListItem> {
    const [updated] = await this.db
      .update(users)
      .set({ accountStatus })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning(userListColumns)

    if (updated === undefined) {
      throw new NotFoundError('User', id)
    }

    const roleCodesByUserId = await this.loadRoleCodesByUserIds([updated.id])

    return mapUserRow(updated, roleCodesByUserId.get(updated.id) ?? [])
  }

  async setActive(id: string, isActive: boolean): Promise<UserListItem> {
    const [updated] = await this.db
      .update(users)
      .set({ isActive })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning(userListColumns)

    if (updated === undefined) {
      throw new NotFoundError('User', id)
    }

    const roleCodesByUserId = await this.loadRoleCodesByUserIds([updated.id])

    return mapUserRow(updated, roleCodesByUserId.get(updated.id) ?? [])
  }

  async approvePendingUser(
    id: string,
    roleCode: string,
    assignedBy: string,
    customerIds: readonly string[],
  ): Promise<UserListItem> {
    return this.db.transaction(async (tx) => {
      const [userRow] = await tx
        .select(userListColumns)
        .from(users)
        .where(
          and(
            eq(users.id, id),
            eq(users.accountStatus, UserAccountStatus.Pending),
            isNull(users.deletedAt),
          ),
        )
        .limit(1)

      if (userRow === undefined) {
        throw new ValidationError('Status naloga može menjati samo korisnik na čekanju.')
      }

      const [roleRow] = await tx
        .select({ id: roles.id, code: roles.code })
        .from(roles)
        .where(and(eq(roles.code, roleCode), isNull(roles.deletedAt)))
        .limit(1)

      if (roleRow === undefined) {
        throw new ValidationError('Izabrana uloga nije validna.')
      }

      // Validate the linked customers BEFORE any write so an invalid customer
      // rolls the whole approval back — the role is never assigned (atomicity).
      const uniqueCustomerIds = [...new Set(customerIds)]
      if (roleCode === SYSTEM_ROLE_CLIENT) {
        if (uniqueCustomerIds.length === 0) {
          throw new ValidationError('Klijent mora biti vezan za bar jednu firmu.')
        }

        const linkable = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              inArray(customers.id, uniqueCustomerIds),
              eq(customers.kind, CustomerKind.EmotivePartner),
              eq(customers.isActive, true),
              isNull(customers.deletedAt),
            ),
          )

        if (linkable.length !== uniqueCustomerIds.length) {
          throw new ValidationError('Jedna ili više izabranih firmi nije validna.')
        }
      }

      await tx.delete(userRoles).where(eq(userRoles.userId, id))

      const [updated] = await tx
        .update(users)
        // `requested_company` is the free text the applicant typed at registration.
        // Approval resolves it into a real firm (customer_users), so the hint has
        // done its job — keeping it would leave dead text no screen ever shows
        // again (docs/16 §5.2). Cleared inside this transaction, so a rejected
        // role or an invalid firm rolls the clear back together with the approval.
        .set({ accountStatus: UserAccountStatus.Approved, requestedCompany: null })
        .where(eq(users.id, id))
        .returning(userListColumns)

      if (updated === undefined) {
        throw new NotFoundError('User', id)
      }

      await tx.insert(userRoles).values({
        userId: id,
        roleId: roleRow.id,
        assignedBy,
      })

      if (roleCode === SYSTEM_ROLE_CLIENT && uniqueCustomerIds.length > 0) {
        await tx.insert(customerUsers).values(
          uniqueCustomerIds.map((customerId) => ({
            customerId,
            userId: id,
            assignedBy,
          })),
        )
      }

      return mapUserRow(updated, [roleRow.code])
    })
  }

  async replaceRoles(
    id: string,
    roleCodes: readonly string[],
    assignedBy: string,
  ): Promise<UserListItem> {
    return this.db.transaction(async (tx) => {
      const [userRow] = await tx
        .select(userListColumns)
        .from(users)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .limit(1)

      if (userRow === undefined) {
        throw new NotFoundError('User', id)
      }

      const roleRows = await tx
        .select({ id: roles.id, code: roles.code })
        .from(roles)
        .where(and(inArray(roles.code, [...roleCodes]), isNull(roles.deletedAt)))

      if (roleRows.length !== roleCodes.length) {
        throw new ValidationError('Jedna ili više uloga nije validna.')
      }

      await tx.delete(userRoles).where(eq(userRoles.userId, id))

      if (roleRows.length > 0) {
        await tx.insert(userRoles).values(
          roleRows.map((role) => ({
            userId: id,
            roleId: role.id,
            assignedBy,
          })),
        )
      }

      return mapUserRow(
        userRow,
        roleRows.map((role) => role.code),
      )
    })
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
