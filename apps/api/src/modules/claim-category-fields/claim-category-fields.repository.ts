import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'

import {
  categoryFieldOptionUsageCountSql,
  categoryFieldUsageCountSql,
} from '../../core/claims/category-field-usage-sql.js'
import type { ApiDatabase } from '../../core/database.js'
import { ConflictError, InternalError, NotFoundError } from '../../core/errors/domain-errors.js'
import { keysetAfter } from '../../core/utils/drizzle-keyset.js'
import { buildPaginatedSlice, parseOptionalKeysetCursor } from '../../core/utils/pagination.js'
import {
  claimCategories,
  claimCategoryFieldOptions,
  claimCategoryFields,
} from './claim-category-fields.schema.js'
import type {
  ClaimCategoryFieldCreateInput,
  ClaimCategoryFieldListItem,
  ClaimCategoryFieldOptionListItem,
  ClaimCategoryFieldUpdateInput,
  ClaimCategoryFieldsListQuery,
  ReferenceListResponse,
} from './claim-category-fields.validators.js'

/**
 * What the claim services validate a claim's values against: every field of one category with
 * every option, retired ones included — a claim keeps what the office has since switched off.
 */
export interface CategoryFieldCatalogField {
  id: string
  categoryId: string
  code: string
  isActive: boolean
  options: { code: string; isActive: boolean }[]
}

interface FieldRow {
  id: string
  categoryId: string
  categoryName: string
  code: string
  name: string
  fieldType: 'select'
  sortOrder: number
  isActive: boolean
  deactivatedAt: Date | null
  createdAt: Date
  usageCount: number
}

const fieldSelection = {
  id: claimCategoryFields.id,
  categoryId: claimCategoryFields.categoryId,
  categoryName: claimCategories.name,
  code: claimCategoryFields.code,
  name: claimCategoryFields.name,
  fieldType: claimCategoryFields.fieldType,
  sortOrder: claimCategoryFields.sortOrder,
  isActive: claimCategoryFields.isActive,
  deactivatedAt: claimCategoryFields.deactivatedAt,
  createdAt: claimCategoryFields.createdAt,
  usageCount: categoryFieldUsageCountSql,
}

function mapField(
  row: FieldRow,
  options?: ClaimCategoryFieldOptionListItem[],
): ClaimCategoryFieldListItem {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    code: row.code,
    name: row.name,
    fieldType: row.fieldType,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    usageCount: row.usageCount,
    ...(options === undefined ? {} : { options }),
  }
}

export class ClaimCategoryFieldsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(
    query: ClaimCategoryFieldsListQuery,
  ): Promise<ReferenceListResponse<ClaimCategoryFieldListItem>> {
    const cursor = parseOptionalKeysetCursor(query.cursor)
    const conditions: SQL[] = [isNull(claimCategoryFields.deletedAt)]

    if (query.activeOnly) {
      conditions.push(eq(claimCategoryFields.isActive, true))
    }

    if (query.categoryId !== undefined) {
      conditions.push(eq(claimCategoryFields.categoryId, query.categoryId))
    }

    if (query.search !== undefined) {
      const pattern = `%${query.search}%`
      const searchCondition = or(
        ilike(claimCategoryFields.code, pattern),
        ilike(claimCategoryFields.name, pattern),
      )
      if (searchCondition !== undefined) {
        conditions.push(searchCondition)
      }
    }

    const keysetCondition = keysetAfter(
      claimCategoryFields.sortOrder,
      claimCategoryFields.id,
      cursor,
    )
    if (keysetCondition !== undefined) {
      conditions.push(keysetCondition)
    }

    const rows = await this.db
      .select(fieldSelection)
      .from(claimCategoryFields)
      .innerJoin(claimCategories, eq(claimCategories.id, claimCategoryFields.categoryId))
      .where(and(...conditions))
      .orderBy(asc(claimCategoryFields.sortOrder), asc(claimCategoryFields.id))
      .limit(query.limit + 1)

    const page = buildPaginatedSlice(rows, query.limit, (row) => ({
      primary: row.sortOrder,
      id: row.id,
    }))

    const optionsByField = query.includeOptions
      ? await this.optionsFor(page.items.map((row) => row.id))
      : undefined

    return {
      items: page.items.map((row) =>
        mapField(row, query.includeOptions ? (optionsByField?.get(row.id) ?? []) : undefined),
      ),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    }
  }

  /** Every option of the given fields in ONE query — never one per field. */
  private async optionsFor(
    fieldIds: string[],
  ): Promise<Map<string, ClaimCategoryFieldOptionListItem[]>> {
    const grouped = new Map<string, ClaimCategoryFieldOptionListItem[]>()
    if (fieldIds.length === 0) {
      return grouped
    }

    const rows = await this.db
      .select({
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
      })
      .from(claimCategoryFieldOptions)
      .innerJoin(claimCategoryFields, eq(claimCategoryFields.id, claimCategoryFieldOptions.fieldId))
      .where(
        and(
          inArray(claimCategoryFieldOptions.fieldId, fieldIds),
          isNull(claimCategoryFieldOptions.deletedAt),
        ),
      )
      .orderBy(asc(claimCategoryFieldOptions.sortOrder), asc(claimCategoryFieldOptions.id))

    for (const row of rows) {
      const list = grouped.get(row.fieldId) ?? []
      list.push({
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
      })
      grouped.set(row.fieldId, list)
    }

    return grouped
  }

  /** The validation view: no pagination, no names, just what is real and what is still alive. */
  async listForCategory(categoryId: string): Promise<CategoryFieldCatalogField[]> {
    const fields = await this.db
      .select({
        id: claimCategoryFields.id,
        categoryId: claimCategoryFields.categoryId,
        code: claimCategoryFields.code,
        isActive: claimCategoryFields.isActive,
      })
      .from(claimCategoryFields)
      .where(
        and(eq(claimCategoryFields.categoryId, categoryId), isNull(claimCategoryFields.deletedAt)),
      )

    if (fields.length === 0) {
      return []
    }

    const options = await this.db
      .select({
        fieldId: claimCategoryFieldOptions.fieldId,
        code: claimCategoryFieldOptions.code,
        isActive: claimCategoryFieldOptions.isActive,
      })
      .from(claimCategoryFieldOptions)
      .where(
        and(
          inArray(
            claimCategoryFieldOptions.fieldId,
            fields.map((field) => field.id),
          ),
          isNull(claimCategoryFieldOptions.deletedAt),
        ),
      )

    return fields.map((field) => ({
      ...field,
      options: options
        .filter((option) => option.fieldId === field.id)
        .map((option) => ({ code: option.code, isActive: option.isActive })),
    }))
  }

  async findById(id: string): Promise<ClaimCategoryFieldListItem | null> {
    const [row] = await this.db
      .select(fieldSelection)
      .from(claimCategoryFields)
      .innerJoin(claimCategories, eq(claimCategories.id, claimCategoryFields.categoryId))
      .where(and(eq(claimCategoryFields.id, id), isNull(claimCategoryFields.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapField(row)
  }

  async create(input: ClaimCategoryFieldCreateInput): Promise<ClaimCategoryFieldListItem> {
    const [existing] = await this.db
      .select({ id: claimCategoryFields.id })
      .from(claimCategoryFields)
      .where(
        and(
          eq(claimCategoryFields.categoryId, input.categoryId),
          eq(claimCategoryFields.code, input.code),
          isNull(claimCategoryFields.deletedAt),
        ),
      )
      .limit(1)

    if (existing !== undefined) {
      throw new ConflictError(`Field with code ${input.code} already exists in this category`)
    }

    const [created] = await this.db
      .insert(claimCategoryFields)
      .values({
        categoryId: input.categoryId,
        code: input.code,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      })
      .returning({ id: claimCategoryFields.id })

    if (created === undefined) {
      throw new InternalError('Failed to create claim category field')
    }

    const found = await this.findById(created.id)
    if (found === null) {
      throw new InternalError('Created claim category field could not be read back')
    }
    return found
  }

  async update(
    id: string,
    input: ClaimCategoryFieldUpdateInput,
  ): Promise<ClaimCategoryFieldListItem> {
    const [updated] = await this.db
      .update(claimCategoryFields)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined
          ? {
              isActive: input.isActive,
              // Same rule as the category above it: switching off stamps the moment and keeps
              // the first date; switching back on clears it.
              deactivatedAt: input.isActive
                ? null
                : sql`COALESCE(${claimCategoryFields.deactivatedAt}, now())`,
            }
          : {}),
      })
      .where(and(eq(claimCategoryFields.id, id), isNull(claimCategoryFields.deletedAt)))
      .returning({ id: claimCategoryFields.id })

    if (updated === undefined) {
      throw new NotFoundError('Claim category field', id)
    }

    const found = await this.findById(id)
    if (found === null) {
      throw new NotFoundError('Claim category field', id)
    }
    return found
  }

  async hardDelete(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(claimCategoryFields)
      .where(and(eq(claimCategoryFields.id, id), isNull(claimCategoryFields.deletedAt)))
      .returning({ id: claimCategoryFields.id })

    if (deleted === undefined) {
      throw new NotFoundError('Claim category field', id)
    }
  }
}
