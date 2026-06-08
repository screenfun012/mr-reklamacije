import { queryOptions } from '@tanstack/react-query'

import type {
  ClaimSourceListItem,
  CustomerListItem,
  CustomersListQuery,
  DepartmentListItem,
  EmployeeListItem,
  EmployeesListQuery,
  EngineTypeListItem,
  ExternalPartyListItem,
  ReferenceListQuery,
} from '../schemas/reference-data.schema.js'
import { fetchAllReferencePages } from './fetch-all-reference-pages.js'

const REFERENCE_STALE_MS = Number.POSITIVE_INFINITY
const REFERENCE_GC_MS = Number.POSITIVE_INFINITY

export type CustomersReferenceFilters = Partial<
  Pick<CustomersListQuery, 'kind' | 'search' | 'activeOnly'>
>

export type ReferenceLookupFilters = Partial<Pick<ReferenceListQuery, 'search' | 'activeOnly'>>

export type EmployeesReferenceFilters = Partial<
  Pick<EmployeesListQuery, 'search' | 'activeOnly' | 'departmentId'>
>

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

export function employeesReferenceQueryKey(
  filters: EmployeesReferenceFilters = {},
): readonly ['employees', 'reference', EmployeesReferenceFilters] {
  return ['employees', 'reference', filters] as const
}

export function employeesReferenceOptions(filters: EmployeesReferenceFilters = {}) {
  return queryOptions({
    queryKey: employeesReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<EmployeeListItem>('/api/employees', {
        activeOnly: filters.activeOnly ?? true,
        search: filters.search,
        departmentId: filters.departmentId,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

export function departmentsReferenceQueryKey(
  filters: ReferenceLookupFilters = {},
): readonly ['departments', 'reference', ReferenceLookupFilters] {
  return ['departments', 'reference', filters] as const
}

export function departmentsReferenceOptions(filters: ReferenceLookupFilters = {}) {
  return queryOptions({
    queryKey: departmentsReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<DepartmentListItem>('/api/departments', {
        activeOnly: filters.activeOnly ?? true,
        search: filters.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

export function externalPartiesReferenceQueryKey(
  filters: ReferenceLookupFilters = {},
): readonly ['external-parties', 'reference', ReferenceLookupFilters] {
  return ['external-parties', 'reference', filters] as const
}

export function externalPartiesReferenceOptions(filters: ReferenceLookupFilters = {}) {
  return queryOptions({
    queryKey: externalPartiesReferenceQueryKey(filters),
    queryFn: () =>
      fetchAllReferencePages<ExternalPartyListItem>('/api/external-parties', {
        activeOnly: filters.activeOnly ?? true,
        search: filters.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}
