import { queryOptions } from '@tanstack/react-query'

import type {
  ClaimCategoryFieldListItem,
  ClaimCategoryFieldOptionListItem,
} from '../schemas/claim-category-field.schema.js'
import { fetchAllReferencePages } from './fetch-all-reference-pages.js'

const REFERENCE_STALE_MS = Number.POSITIVE_INFINITY
const REFERENCE_GC_MS = Number.POSITIVE_INFINITY

export interface ClaimCategoryFieldsReferenceFilters {
  categoryId?: string
  activeOnly?: boolean
  includeOptions?: boolean
}

export function claimCategoryFieldsReferenceQueryKey(
  filters: ClaimCategoryFieldsReferenceFilters = {},
): readonly ['claim-category-fields', 'reference', ClaimCategoryFieldsReferenceFilters] {
  return ['claim-category-fields', 'reference', filters] as const
}

export function claimCategoryFieldsReferenceOptions(
  filters: ClaimCategoryFieldsReferenceFilters = {},
) {
  return queryOptions({
    queryKey: claimCategoryFieldsReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<ClaimCategoryFieldListItem>('/api/claim-category-fields', {
        categoryId: filters.categoryId,
        activeOnly: filters.activeOnly ?? true,
        includeOptions: filters.includeOptions ?? false,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

/**
 * Every field of one category WITH its options, retired ones included — the detail of an old
 * claim has to name a field or a value nobody offers anymore (V2 spec §4.5). The create form
 * filters this down to the live ones itself.
 */
export function claimCategoryFieldsForCategoryOptions(categoryId: string) {
  return claimCategoryFieldsReferenceOptions({
    categoryId,
    activeOnly: false,
    includeOptions: true,
  })
}

export interface ClaimCategoryFieldOptionsReferenceFilters {
  fieldId?: string
  activeOnly?: boolean
}

export function claimCategoryFieldOptionsReferenceQueryKey(
  filters: ClaimCategoryFieldOptionsReferenceFilters = {},
): readonly [
  'claim-category-field-options',
  'reference',
  ClaimCategoryFieldOptionsReferenceFilters,
] {
  return ['claim-category-field-options', 'reference', filters] as const
}

export function claimCategoryFieldOptionsReferenceOptions(
  filters: ClaimCategoryFieldOptionsReferenceFilters = {},
) {
  return queryOptions({
    queryKey: claimCategoryFieldOptionsReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<ClaimCategoryFieldOptionListItem>(
        '/api/claim-category-field-options',
        {
          fieldId: filters.fieldId,
          activeOnly: filters.activeOnly ?? true,
        },
      ),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}
