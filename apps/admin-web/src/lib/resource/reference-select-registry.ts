import {
  EMOTIVE_PARTNER_CUSTOMERS_REFERENCE,
  customersReferenceOptions,
  departmentsReferenceOptions,
  engineManufacturersReferenceOptions,
  type CustomerListItem,
  type DepartmentListItem,
  type EngineManufacturerListItem,
} from '@mr/shared'
import type { QueryKey, UseSuspenseQueryOptions } from '@tanstack/react-query'

export type ResourceReferenceSelectKey = 'engine-manufacturers' | 'customers' | 'departments'

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
  departments: defineReferenceSelect<DepartmentListItem>({
    queryOptions: () => departmentsReferenceOptions({ activeOnly: true }),
    toOptions: (items) =>
      items.map((item) => ({ value: item.id, label: item.nameSr, keywords: item.code })),
  }),
}

export function getReferenceSelectConfig(key: ResourceReferenceSelectKey): ReferenceSelectConfig {
  return REFERENCE_SELECT_CONFIGS[key]
}
