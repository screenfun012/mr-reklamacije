import { and, eq, ilike, isNull, or, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import {
  buildPaginatedSlice,
  parseOptionalKeysetCursor,
} from '../../core/utils/pagination.js'
import { claimSources, customers } from './claim-sources.schema.js'
import type {
  ClaimSourceListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './claim-sources.validators.js'

interface ClaimSourceRow {
  id: string
  code: string
  name: string
  claimNumberPrefix: string | null
  sortOrder: number
  defaultCustomerId: string | null
  defaultCustomerName: string | null
  isActive: boolean
}

function mapClaimSourceRow(row: ClaimSourceRow): ClaimSourceListItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    claimNumberPrefix: row.claimNumberPrefix,
    sortOrder: row.sortOrder,
    defaultCustomerId: row.defaultCustomerId,
    defaultCustomer:
      row.defaultCustomerId !== null && row.defaultCustomerName !== null
        ? { id: row.defaultCustomerId, name: row.defaultCustomerName }
        : null,
    isActive: row.isActive,
  }
}

export class ClaimSourcesRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<ClaimSourceListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(claimSources.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(claimSources.isActive, true))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      conditions.push(or(ilike(claimSources.name, pattern), ilike(claimSources.code, pattern))!)
    }

    const keysetCondition = keysetAfter(claimSources.sortOrder, claimSources.id, cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        id: claimSources.id,
        code: claimSources.code,
        name: claimSources.name,
        claimNumberPrefix: claimSources.claimNumberPrefix,
        sortOrder: claimSources.sortOrder,
        defaultCustomerId: claimSources.defaultCustomerId,
        defaultCustomerName: customers.name,
        isActive: claimSources.isActive,
      })
      .from(claimSources)
      .leftJoin(customers, eq(claimSources.defaultCustomerId, customers.id))
      .where(and(...conditions))
      .orderBy(claimSources.sortOrder, claimSources.id)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.sortOrder,
      id: row.id,
    }))

    return {
      items: page.items.map(mapClaimSourceRow),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }
}
