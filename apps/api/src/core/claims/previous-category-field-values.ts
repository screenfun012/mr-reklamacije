import { schema } from '@mr/db'
import type { ClaimPreviousCategoryFieldValues } from '@mr/shared'
import { and, inArray, isNull } from 'drizzle-orm'

import type { ApiDatabase } from '../database.js'
import {
  previousCategoryIdsOf,
  type StoredCategoryFieldValues,
} from './category-field-values-store.js'

const { claimCategories, claimCategoryFieldOptions, claimCategoryFields } = schema

/**
 * Turns the answers a claim carries for kinds of work it has been MOVED AWAY FROM into words:
 * the category's name, each field's name, and the option's name (or, for a typed field, the words
 * themselves). Read-only — the claim keeps them so a corrected mistake never destroys what
 * somebody typed (handoff „promena kategorije", §3).
 *
 * Costs nothing in the normal case: a claim that never changed category has no previous ids and
 * this returns without a query. Retired and soft-deleted rows are deliberately included — a claim
 * has to be able to name what it carries, whatever the office has since switched off.
 *
 * It lives in `core/` because both claim families need it and a module may not import a module;
 * the tables come from `@mr/db`, which every module reads.
 */
export async function describePreviousCategoryFieldValues(
  db: ApiDatabase,
  stored: StoredCategoryFieldValues | null,
  currentCategoryId: string | null,
): Promise<ClaimPreviousCategoryFieldValues[]> {
  const previousIds = previousCategoryIdsOf(stored, currentCategoryId)
  if (previousIds.length === 0 || stored === null) {
    return []
  }

  const categories = await db
    .select({ id: claimCategories.id, code: claimCategories.code, name: claimCategories.name })
    .from(claimCategories)
    .where(inArray(claimCategories.id, previousIds))

  const fields = await db
    .select({
      id: claimCategoryFields.id,
      categoryId: claimCategoryFields.categoryId,
      code: claimCategoryFields.code,
      name: claimCategoryFields.name,
      sortOrder: claimCategoryFields.sortOrder,
    })
    .from(claimCategoryFields)
    .where(
      and(
        inArray(claimCategoryFields.categoryId, previousIds),
        isNull(claimCategoryFields.deletedAt),
      ),
    )

  const options =
    fields.length === 0
      ? []
      : await db
          .select({
            fieldId: claimCategoryFieldOptions.fieldId,
            code: claimCategoryFieldOptions.code,
            name: claimCategoryFieldOptions.name,
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

  return previousIds
    .map((categoryId) => {
      const category = categories.find((row) => row.id === categoryId)
      const categoryFields = fields.filter((field) => field.categoryId === categoryId)
      const values = Object.entries(stored[categoryId] ?? {}).map(([fieldCode, value]) => {
        const field = categoryFields.find((row) => row.code === fieldCode)
        const option =
          field === undefined
            ? undefined
            : options.find((row) => row.fieldId === field.id && row.code === value)
        // A field or option the office has since deleted outright still shows its raw code —
        // what was entered is worth more than a tidy blank.
        return { fieldCode, fieldName: field?.name ?? fieldCode, display: option?.name ?? value }
      })

      return {
        categoryCode: category?.code ?? '',
        categoryName: category?.name ?? '',
        values: values.sort((left, right) => {
          const leftOrder =
            categoryFields.find((row) => row.code === left.fieldCode)?.sortOrder ?? 0
          const rightOrder =
            categoryFields.find((row) => row.code === right.fieldCode)?.sortOrder ?? 0
          return leftOrder - rightOrder || left.fieldName.localeCompare(right.fieldName)
        }),
      }
    })
    .filter((section) => section.values.length > 0)
}
