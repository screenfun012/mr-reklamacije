import type { ClaimCategoryFieldType } from '@mr/shared'

/**
 * What a claim service needs to know about a category's fields in order to judge the answers a
 * claim carries — nothing more.
 *
 * It is a port in `core/` rather than a direct import of the catalogue's repository because a
 * module may not import another module (CLAUDE.md, layer law; dependency-cruiser enforces it).
 * The container hands both claim services the real repository, which satisfies this shape.
 */
export interface CategoryFieldCatalogOption {
  code: string
  isActive: boolean
}

export interface CategoryFieldCatalogField {
  id: string
  categoryId: string
  code: string
  /** `select` is answered from `options`; `text` is typed, and then `options` is empty. */
  fieldType: ClaimCategoryFieldType
  isRequired: boolean
  isActive: boolean
  options: CategoryFieldCatalogOption[]
}

export interface CategoryFieldsPort {
  /** Every field of one category with every option — retired rows included, on purpose. */
  listForCategory(categoryId: string): Promise<CategoryFieldCatalogField[]>
}
