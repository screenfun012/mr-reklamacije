import {
  EMOTIVE_PARTNER_CUSTOMERS_REFERENCE,
  claimCategoriesReferenceOptions,
  claimCategoryFieldOptionsReferenceOptions,
  claimCategoryFieldsReferenceOptions,
  customersReferenceOptions,
  departmentsReferenceOptions,
  engineManufacturersReferenceOptions,
  type ClaimCategoryFieldListItem,
  type ClaimCategoryFieldOptionListItem,
  type ClaimCategoryListItem,
  type CustomerListItem,
  type DepartmentListItem,
  type EngineManufacturerListItem,
} from '@mr/shared'
import type { QueryKey, UseSuspenseQueryOptions } from '@tanstack/react-query'

export type ResourceReferenceSelectKey =
  | 'engine-manufacturers'
  | 'customers'
  | 'departments'
  | 'claim-categories'
  | 'claim-category-fields'
  | 'claim-category-field-options'

export interface ReferenceSelectOption {
  value: string
  label: string
  keywords?: string
}

type ErasedQueryOptions = UseSuspenseQueryOptions<
  readonly unknown[],
  Error,
  readonly unknown[],
  QueryKey
>

export interface ReferenceSelectConfig {
  queryOptions: () => ErasedQueryOptions
  toOptions: (items: readonly unknown[]) => ReferenceSelectOption[]
}

/**
 * Type-safe per-entry definition; erased to a uniform shape at the boundary so
 * the form field can consume any reference catalog without knowing its item type.
 */
function defineReferenceSelect<TItem>(config: {
  queryOptions: () => unknown
  toOptions: (items: readonly TItem[]) => ReferenceSelectOption[]
}): ReferenceSelectConfig {
  return config as unknown as ReferenceSelectConfig
}

const REFERENCE_SELECT_CONFIGS: Record<ResourceReferenceSelectKey, ReferenceSelectConfig> = {
  'engine-manufacturers': defineReferenceSelect<EngineManufacturerListItem>({
    queryOptions: () => engineManufacturersReferenceOptions({ activeOnly: true }),
    toOptions: (items) =>
      items.map((item) => ({ value: item.id, label: item.name, keywords: item.code })),
  }),
  customers: defineReferenceSelect<CustomerListItem>({
    queryOptions: () => customersReferenceOptions(EMOTIVE_PARTNER_CUSTOMERS_REFERENCE),
    toOptions: (items) => items.map((item) => ({ value: item.id, label: item.name })),
  }),
  'claim-categories': defineReferenceSelect<ClaimCategoryListItem>({
    queryOptions: () => claimCategoriesReferenceOptions({ activeOnly: true }),
    toOptions: (items) =>
      items.map((item) => ({ value: item.id, label: item.name, keywords: item.code })),
  }),
  'claim-category-fields': defineReferenceSelect<ClaimCategoryFieldListItem>({
    queryOptions: () => claimCategoryFieldsReferenceOptions({ activeOnly: true }),
    // "Mašinska obrada › Obrađeni deo": a field's name alone is ambiguous once two categories
    // own a field with the same name, which is exactly what the codes allow.
    toOptions: (items) =>
      items.map((item) => ({
        value: item.id,
        label: `${item.categoryName} › ${item.name}`,
        keywords: item.code,
      })),
  }),
  'claim-category-field-options': defineReferenceSelect<ClaimCategoryFieldOptionListItem>({
    queryOptions: () => claimCategoryFieldOptionsReferenceOptions({ activeOnly: true }),
    // "Sklop u kvaru › Glava" — an option's name alone repeats across fields. The list is
    // deliberately unfiltered: the registry has no way for one form field to narrow another, and
    // the server refuses a parent from another category or from the same field anyway.
    toOptions: (items) =>
      items.map((item) => ({
        value: item.id,
        label: `${item.fieldName} › ${item.name}`,
        keywords: item.code,
      })),
  }),
  departments: defineReferenceSelect<DepartmentListItem>({
    queryOptions: () => departmentsReferenceOptions({ activeOnly: true }),
    toOptions: (items) =>
      items.map((item) => ({ value: item.id, label: item.nameSr, keywords: item.code })),
  }),
}

export function getReferenceSelectConfig(key: ResourceReferenceSelectKey): ReferenceSelectConfig {
  return REFERENCE_SELECT_CONFIGS[key]
}
