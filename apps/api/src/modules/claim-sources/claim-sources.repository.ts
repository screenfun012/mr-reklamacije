import { and, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { ApiDatabase } from '../../core/database.js'

import {
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { claimSources, customers } from './claim-sources.schema.js'
import type {
  ClaimSourceCreateInput,
  ClaimSourceListItem,
  ClaimSourceUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './claim-sources.validators.js'

/** Usage = EMOTIVE claims referencing this source (FK restrict). DOMACE claims have no source. */
const claimSourceUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int FROM emotive_claims
    WHERE emotive_claims.source_id = claim_sources.id AND emotive_claims.deleted_at IS NULL
  ), 0)
)`.mapWith(Number)

interface ClaimSourceRow {
  id: string
  code: string
  name: string
  claimNumberPrefix: string | null
  sortOrder: number
  defaultCustomerId: string | null
  defaultCustomerName: string | null
  isActive: boolean
  usageCount: number
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
    usageCount: row.usageCount,
  }
}

const CLAIM_SOURCE_SELECT = {
  id: claimSources.id,
  code: claimSources.code,
  name: claimSources.name,
  claimNumberPrefix: claimSources.claimNumberPrefix,
  sortOrder: claimSources.sortOrder,
  defaultCustomerId: claimSources.defaultCustomerId,
  defaultCustomerName: customers.name,
  isActive: claimSources.isActive,
  usageCount: claimSourceUsageCountSql,
} as const

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
      .select(CLAIM_SOURCE_SELECT)
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

  async findById(id: string): Promise<ClaimSourceListItem | null> {
    const [row] = await this.db
      .select(CLAIM_SOURCE_SELECT)
      .from(claimSources)
      .leftJoin(customers, eq(claimSources.defaultCustomerId, customers.id))
      .where(and(eq(claimSources.id, id), isNull(claimSources.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapClaimSourceRow(row)
  }

  private async assertCustomerExists(customerId: string): Promise<void> {
    const [customer] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
      .limit(1)

    if (customer === undefined) {
      throw new ValidationError('Izabrana firma ne postoji.')
    }
  }

  async create(input: ClaimSourceCreateInput): Promise<ClaimSourceListItem> {
    const [existing] = await this.db
      .select({ id: claimSources.id })
      .from(claimSources)
      .where(and(eq(claimSources.code, input.code), isNull(claimSources.deletedAt)))
      .limit(1)

    if (existing !== undefined) {
      throw new ConflictError(`Izvor sa šifrom "${input.code}" već postoji.`)
    }

    if (input.defaultCustomerId !== undefined) {
      await this.assertCustomerExists(input.defaultCustomerId)
    }

    const [created] = await this.db
      .insert(claimSources)
      .values({
        code: input.code,
        name: input.name,
        claimNumberPrefix: input.claimNumberPrefix ?? null,
        sortOrder: input.sortOrder ?? 0,
        defaultCustomerId: input.defaultCustomerId ?? null,
        isActive: true,
      })
      .returning({ id: claimSources.id })

    if (created === undefined) {
      throw new InternalError('Failed to create claim source')
    }

    const item = await this.findById(created.id)
    if (item === null) {
      throw new InternalError('Failed to load created claim source')
    }
    return item
  }

  async update(id: string, input: ClaimSourceUpdateInput): Promise<ClaimSourceListItem> {
    if (input.defaultCustomerId !== undefined && input.defaultCustomerId !== null) {
      await this.assertCustomerExists(input.defaultCustomerId)
    }

    const [updated] = await this.db
      .update(claimSources)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.claimNumberPrefix !== undefined
          ? { claimNumberPrefix: input.claimNumberPrefix }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.defaultCustomerId !== undefined
          ? { defaultCustomerId: input.defaultCustomerId }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(and(eq(claimSources.id, id), isNull(claimSources.deletedAt)))
      .returning({ id: claimSources.id })

    if (updated === undefined) {
      throw new NotFoundError('Claim source', id)
    }

    const item = await this.findById(id)
    if (item === null) {
      throw new NotFoundError('Claim source', id)
    }
    return item
  }

  async getUsageCount(id: string): Promise<number> {
    const [row] = await this.db
      .select({ usageCount: claimSourceUsageCountSql })
      .from(claimSources)
      .where(and(eq(claimSources.id, id), isNull(claimSources.deletedAt)))
      .limit(1)

    return row?.usageCount ?? 0
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(claimSources)
      .where(and(eq(claimSources.id, id), isNull(claimSources.deletedAt)))
      .returning({ id: claimSources.id })

    if (deleted === undefined) {
      throw new NotFoundError('Claim source', id)
    }
  }
}
