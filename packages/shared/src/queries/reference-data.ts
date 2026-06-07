import { queryOptions } from '@tanstack/react-query'

import type {
  ClaimSourceListItem,
  CustomerListItem,
  CustomersListQuery,
  EngineTypeListItem,
  ReferenceListQuery,
} from '../schemas/reference-data.schema.js'
import { fetchAllReferencePages } from './fetch-all-reference-pages.js'

const REFERENCE_STALE_MS = Number.POSITIVE_INFINITY
const REFERENCE_GC_MS = Number.POSITIVE_INFINITY

export type CustomersReferenceFilters = Partial<
  Pick<CustomersListQuery, 'kind' | 'search' | 'activeOnly'>
>

export type ReferenceLookupFilters = Partial<Pick<ReferenceListQuery, 'search' | 'activeOnly'>>

export function customersReferenceQueryKey(
  filters: CustomersReferenceFilters = {},
): readonly ['customers', 'reference', CustomersReferenceFilters] {
  return ['customers', 'reference', filters] as const
}

export function customersReferenceOptions(filters: CustomersReferenceFilters = {}) {
  return queryOptions({
    queryKey: customersReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<CustomerListItem>('/api/customers', {
        activeOnly: filters.activeOnly ?? true,
        kind: filters.kind,
        search: filters.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

export function claimSourcesReferenceQueryKey(
  filters: ReferenceLookupFilters = {},
): readonly ['claim-sources', 'reference', ReferenceLookupFilters] {
  return ['claim-sources', 'reference', filters] as const
}

export function claimSourcesReferenceOptions(filters: ReferenceLookupFilters = {}) {
  return queryOptions({
    queryKey: claimSourcesReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<ClaimSourceListItem>('/api/claim-sources', {
        activeOnly: filters.activeOnly ?? true,
        search: filters.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

export function engineTypesReferenceQueryKey(
  filters: ReferenceLookupFilters = {},
): readonly ['engine-types', 'reference', ReferenceLookupFilters] {
  return ['engine-types', 'reference', filters] as const
}

export function engineTypesReferenceOptions(filters: ReferenceLookupFilters = {}) {
  return queryOptions({
    queryKey: engineTypesReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<EngineTypeListItem>('/api/engine-types', {
        activeOnly: filters.activeOnly ?? true,
        search: filters.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}
