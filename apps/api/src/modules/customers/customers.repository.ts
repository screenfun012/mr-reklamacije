import { and, eq, ilike, isNull, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { customers } from './customers.schema.js'
import type {
  CustomerListItem,
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
}

function mapCustomerRow(row: CustomerRow): CustomerListItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    country: row.country,
    city: row.city,
    isActive: row.isActive,
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
}
