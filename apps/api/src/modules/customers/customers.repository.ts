import { CustomerKind } from '@mr/shared'
import { and, eq, ilike, isNull, sql, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { customerUsers, customers, emotiveClaims } from './customers.schema.js'
import type {
  CustomerCreateInput,
  CustomerListItem,
  CustomerUpdateInput,
  CustomersListQuery,
  ReferenceListResponse,
} from './customers.validators.js'

interface CustomerRow {
  id: string
  name: string
  kind: CustomerListItem['kind']
  country: string | null
  city: string | null
  isActive: boolean
  usageCount: number
}

const customerUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int
    FROM ${emotiveClaims}
    WHERE ${emotiveClaims.customerId} = ${customers.id}
      AND ${emotiveClaims.deletedAt} IS NULL
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int
    FROM ${customerUsers}
    WHERE ${customerUsers.customerId} = ${customers.id}
  ), 0)
)`.mapWith(Number)

function mapCustomerRow(row: CustomerRow): CustomerListItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    country: row.country,
    city: row.city,
    isActive: row.isActive,
    usageCount: row.usageCount,
  }
}

export class CustomersRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: CustomersListQuery): Promise<ReferenceListResponse<CustomerListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(customers.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(customers.isActive, true))
    }

    if (query.kind !== undefined) {
      conditions.push(eq(customers.kind, query.kind))
    }

    if (query.search !== undefined) {
      conditions.push(ilike(customers.name, `%${query.search}%`))
    }

    const keysetCondition = keysetAfter(customers.name, customers.id, cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        id: customers.id,
        name: customers.name,
        kind: customers.kind,
        country: customers.country,
        city: customers.city,
        isActive: customers.isActive,
        usageCount: customerUsageCountSql,
      })
      .from(customers)
      .where(and(...conditions))
      .orderBy(customers.name, customers.id)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.name,
      id: row.id,
    }))

    return {
      items: page.items.map(mapCustomerRow),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async findById(id: string): Promise<CustomerListItem | null> {
    const [row] = await this.db
      .select({
        id: customers.id,
        name: customers.name,
        kind: customers.kind,
        country: customers.country,
        city: customers.city,
        isActive: customers.isActive,
        usageCount: customerUsageCountSql,
      })
      .from(customers)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapCustomerRow(row)
  }

  async findByNameAndKind(
    name: string,
    kind: CustomerListItem['kind'],
  ): Promise<{ id: string } | null> {
    const [existing] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.name, name), eq(customers.kind, kind), isNull(customers.deletedAt)))
      .limit(1)

    return existing ?? null
  }

  async create(input: CustomerCreateInput): Promise<CustomerListItem> {
    const existing = await this.findByNameAndKind(input.name, CustomerKind.EmotivePartner)
    if (existing !== null) {
      throw new ConflictError(`Firma sa nazivom "${input.name}" već postoji.`)
    }

    const [created] = await this.db
      .insert(customers)
      .values({
        name: input.name,
        kind: CustomerKind.EmotivePartner,
        country: input.country ?? null,
        city: input.city ?? null,
        isActive: true,
      })
      .returning({
        id: customers.id,
        name: customers.name,
        kind: customers.kind,
        country: customers.country,
        city: customers.city,
        isActive: customers.isActive,
      })

    if (created === undefined) {
      throw new InternalError('Failed to create customer')
    }

    return mapCustomerRow({ ...created, usageCount: 0 })
  }

  async update(id: string, input: CustomerUpdateInput): Promise<CustomerListItem> {
    if (input.name !== undefined) {
      const current = await this.findById(id)
      if (current === null) {
        throw new NotFoundError('Customer', id)
      }

      const duplicate = await this.findByNameAndKind(input.name, current.kind)
      if (duplicate !== null && duplicate.id !== id) {
        throw new ConflictError(`Firma sa nazivom "${input.name}" već postoji.`)
      }
    }

    const [updated] = await this.db
      .update(customers)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .returning({
        id: customers.id,
        name: customers.name,
        kind: customers.kind,
        country: customers.country,
        city: customers.city,
        isActive: customers.isActive,
      })

    if (updated === undefined) {
      throw new NotFoundError('Customer', id)
    }

    const usageCount = await this.getUsageCount(id)
    return mapCustomerRow({ ...updated, usageCount })
  }

  async getUsageCount(id: string): Promise<number> {
    const [row] = await this.db
      .select({ usageCount: customerUsageCountSql })
      .from(customers)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .limit(1)

    return row?.usageCount ?? 0
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(customers)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .returning({ id: customers.id })

    if (deleted === undefined) {
      throw new NotFoundError('Customer', id)
    }
  }
}
