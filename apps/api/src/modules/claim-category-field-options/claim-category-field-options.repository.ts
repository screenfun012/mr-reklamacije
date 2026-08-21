import { and, asc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'

import { categoryFieldOptionUsageCountSql } from '../../core/claims/category-field-usage-sql.js'
import type { ApiDatabase } from '../../core/database.js'
import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import {
  claimCategoryFieldOptions,
  claimCategoryFields,
} from './claim-category-field-options.schema.js'
import type {
  ClaimCategoryFieldOptionCreateInput,
  ClaimCategoryFieldOptionListItem,
  ClaimCategoryFieldOptionUpdateInput,
  ClaimCategoryFieldOptionsListQuery,
  ReferenceListResponse,
} from './claim-category-field-options.validators.js'

interface OptionRow {
  id: string
  fieldId: string
  fieldName: string
  code: string
  name: string
  sortOrder: number
  isActive: boolean
  deactivatedAt: Date | null
  createdAt: Date
  usageCount: number
}

const optionSelection = {
  id: claimCategoryFieldOptions.id,
  fieldId: claimCategoryFieldOptions.fieldId,
  fieldName: claimCategoryFields.name,
  code: claimCategoryFieldOptions.code,
  name: claimCategoryFieldOptions.name,
  sortOrder: claimCategoryFieldOptions.sortOrder,
  isActive: claimCategoryFieldOptions.isActive,
  deactivatedAt: claimCategoryFieldOptions.deactivatedAt,
  createdAt: claimCategoryFieldOptions.createdAt,
  usageCount: categoryFieldOptionUsageCountSql,
}

function mapOption(row: OptionRow): ClaimCategoryFieldOptionListItem {
  return {
    id: row.id,
    fieldId: row.fieldId,
    fieldName: row.fieldName,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    usageCount: row.usageCount,
  }
}

export class ClaimCategoryFieldOptionsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(
    query: ClaimCategoryFieldOptionsListQuery,
  ): Promise<ReferenceListResponse<ClaimCategoryFieldOptionListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(claimCategoryFieldOptions.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(claimCategoryFieldOptions.isActive, true))
    }

    if (query.fieldId !== undefined) {
      conditions.push(eq(claimCategoryFieldOptions.fieldId, query.fieldId))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      const searchCondition = or(
        ilike(claimCategoryFieldOptions.code, pattern),
        ilike(claimCategoryFieldOptions.name, pattern),
      )
      if (searchCondition !== undefined) {
        conditions.push(searchCondition)
      }
    }

    const keysetCondition = keysetAfter(
      claimCategoryFieldOptions.sortOrder,
      claimCategoryFieldOptions.id,
      cursor,
    )
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select(optionSelection)
      .from(claimCategoryFieldOptions)
      .innerJoin(claimCategoryFields, eq(claimCategoryFields.id, claimCategoryFieldOptions.fieldId))
      .where(and(...conditions))
      .orderBy(asc(claimCategoryFieldOptions.sortOrder), asc(claimCategoryFieldOptions.id))
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.sortOrder,
      id: row.id,
    }))

    return {
      items: page.items.map(mapOption),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  async findById(id: string): Promise<ClaimCategoryFieldOptionListItem | null> {
    const [row] = await this.db
      .select(optionSelection)
      .from(claimCategoryFieldOptions)
      .innerJoin(claimCategoryFields, eq(claimCategoryFields.id, claimCategoryFieldOptions.fieldId))
      .where(and(eq(claimCategoryFieldOptions.id, id), isNull(claimCategoryFieldOptions.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapOption(row)
  }

  async create(
    input: ClaimCategoryFieldOptionCreateInput,
  ): Promise<ClaimCategoryFieldOptionListItem> {
    const [existing] = await this.db
      .select({ id: claimCategoryFieldOptions.id })
      .from(claimCategoryFieldOptions)
      .where(
        and(
          eq(claimCategoryFieldOptions.fieldId, input.fieldId),
          eq(claimCategoryFieldOptions.code, input.code),
          isNull(claimCategoryFieldOptions.deletedAt),
        ),
      )
      .limit(1)

    if (existing !== undefined) {
      throw new ConflictError(`Option with code ${input.code} already exists for this field`)
    }

    const [created] = await this.db
      .insert(claimCategoryFieldOptions)
      .values({
        fieldId: input.fieldId,
        code: input.code,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      })
      .returning({ id: claimCategoryFieldOptions.id })

    if (created === undefined) {
      throw new InternalError('Failed to create claim category field option')
    }

    const found = await this.findById(created.id)
    if (found === null) {
      throw new InternalError('Created claim category field option could not be read back')
    }
    return found
  }

  async update(
    id: string,
    input: ClaimCategoryFieldOptionUpdateInput,
  ): Promise<ClaimCategoryFieldOptionListItem> {
    const [updated] = await this.db
      .update(claimCategoryFieldOptions)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined
          ? {
              isActive: input.isActive,
              deactivatedAt: input.isActive
                ? null
                : sql`COALESCE(${claimCategoryFieldOptions.deactivatedAt}, now())`,
            }
          : {}),
      })
      .where(and(eq(claimCategoryFieldOptions.id, id), isNull(claimCategoryFieldOptions.deletedAt)))
      .returning({ id: claimCategoryFieldOptions.id })

    if (updated === undefined) {
      throw new NotFoundError('Claim category field option', id)
    }

    const found = await this.findById(id)
    if (found === null) {
      throw new NotFoundError('Claim category field option', id)
    }
    return found
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(claimCategoryFieldOptions)
      .where(and(eq(claimCategoryFieldOptions.id, id), isNull(claimCategoryFieldOptions.deletedAt)))
      .returning({ id: claimCategoryFieldOptions.id })

    if (deleted === undefined) {
      throw new NotFoundError('Claim category field option', id)
    }
  }
}
