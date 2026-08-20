import { and, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import { claimCategories } from './claim-categories.schema.js'
import type {
  ClaimCategoryCreateInput,
  ClaimCategoryListItem,
  ClaimCategoryUpdateInput,
  ReferenceListQuery,
  ReferenceListResponse,
} from './claim-categories.validators.js'

interface ClaimCategoryRow {
  id: string
  code: string
  name: string
  sortOrder: number
  isActive: boolean
  usageCount: number
}

// Spans both claim tables — a category is one catalog shared by EMOTIVE and DOMACE.
const categoryUsageCountSql = sql<number>`(
  COALESCE((
    SELECT COUNT(*)::int
    FROM emotive_claims
    WHERE emotive_claims.category_id = claim_categories.id
      AND emotive_claims.deleted_at IS NULL
  ), 0)
  + COALESCE((
    SELECT COUNT(*)::int
    FROM domace_claims
    WHERE domace_claims.category_id = claim_categories.id
      AND domace_claims.deleted_at IS NULL
  ), 0)
)`.mapWith(Number)

function mapClaimCategoryRow(row: ClaimCategoryRow): ClaimCategoryListItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    usageCount: row.usageCount,
  }
}

export class ClaimCategoriesRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<ClaimCategoryListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(claimCategories.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(claimCategories.isActive, true))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      conditions.push(
        or(ilike(claimCategories.code, pattern), ilike(claimCategories.name, pattern))!,
      )
    }

    const keysetCondition = keysetAfter(claimCategories.sortOrder, claimCategories.id, cursor)
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select({
        id: claimCategories.id,
        code: claimCategories.code,
        name: claimCategories.name,
        sortOrder: claimCategories.sortOrder,
        isActive: claimCategories.isActive,
        usageCount: categoryUsageCountSql,
      })
      .from(claimCategories)
      .where(and(...conditions))
      .orderBy(claimCategories.sortOrder, claimCategories.id)
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.sortOrder,
      id: row.id,
    }))

    return {
      items: page.items.map(mapClaimCategoryRow),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async findById(id: string): Promise<ClaimCategoryListItem | null> {
    const [row] = await this.db
      .select({
        id: claimCategories.id,
        code: claimCategories.code,
        name: claimCategories.name,
        sortOrder: claimCategories.sortOrder,
        isActive: claimCategories.isActive,
        usageCount: categoryUsageCountSql,
      })
      .from(claimCategories)
      .where(and(eq(claimCategories.id, id), isNull(claimCategories.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapClaimCategoryRow(row)
  }

  async create(input: ClaimCategoryCreateInput): Promise<ClaimCategoryListItem> {
    const [existing] = await this.db
      .select({ id: claimCategories.id })
      .from(claimCategories)
      .where(and(eq(claimCategories.code, input.code), isNull(claimCategories.deletedAt)))
      .limit(1)

    if (existing !== undefined) {
      throw new ConflictError(`Claim category with code ${input.code} already exists`)
    }

    const [created] = await this.db
      .insert(claimCategories)
      .values({
        code: input.code,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      })
      .returning({
        id: claimCategories.id,
        code: claimCategories.code,
        name: claimCategories.name,
        sortOrder: claimCategories.sortOrder,
        isActive: claimCategories.isActive,
      })

    if (created === undefined) {
      throw new InternalError('Failed to create claim category')
    }

    return mapClaimCategoryRow({ ...created, usageCount: 0 })
  }

  async update(id: string, input: ClaimCategoryUpdateInput): Promise<ClaimCategoryListItem> {
    const [updated] = await this.db
      .update(claimCategories)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(and(eq(claimCategories.id, id), isNull(claimCategories.deletedAt)))
      .returning({
        id: claimCategories.id,
        code: claimCategories.code,
        name: claimCategories.name,
        sortOrder: claimCategories.sortOrder,
        isActive: claimCategories.isActive,
      })

    if (updated === undefined) {
      throw new NotFoundError('Claim category', id)
    }

    const usageCount = await this.getUsageCount(id)
    return mapClaimCategoryRow({ ...updated, usageCount })
  }

  async getUsageCount(id: string): Promise<number> {
    const [row] = await this.db
      .select({ usageCount: categoryUsageCountSql })
      .from(claimCategories)
      .where(and(eq(claimCategories.id, id), isNull(claimCategories.deletedAt)))
      .limit(1)

    return row?.usageCount ?? 0
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(claimCategories)
      .where(and(eq(claimCategories.id, id), isNull(claimCategories.deletedAt)))
      .returning({ id: claimCategories.id })

    if (deleted === undefined) {
      throw new NotFoundError('Claim category', id)
    }
  }
}
