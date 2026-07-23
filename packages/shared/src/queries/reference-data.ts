import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { CustomerKind } from '../enums.js'
import type {
  ClaimSourceListItem,
  CustomerListItem,
  CustomersListQuery,
  DepartmentListItem,
  EmployeeListItem,
  EmployeesListQuery,
  EngineTypeListItem,
  EngineTypesListQuery,
  EngineManufacturerListItem,
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

export type EngineTypesReferenceFilters = Partial<
  Pick<EngineTypesListQuery, 'search' | 'activeOnly' | 'manufacturerId'>
>

export type EmployeesReferenceFilters = Partial<
  Pick<EmployeesListQuery, 'search' | 'activeOnly' | 'departmentId' | 'assignableOnly'>
>

/** Canonical cache key for active-only catalog lookups (dropdowns). */
export const ACTIVE_REFERENCE_LOOKUP: ReferenceLookupFilters = { activeOnly: true }

export const EMOTIVE_PARTNER_CUSTOMERS_REFERENCE: CustomersReferenceFilters = {
  kind: CustomerKind.EmotivePartner,
  activeOnly: true,
}

function normalizeReferenceLookupFilters(
  filters: ReferenceLookupFilters = {},
): ReferenceLookupFilters {
  if (filters.activeOnly !== undefined) {
    return filters
  }
  return { ...filters, activeOnly: true }
}

function normalizeEmployeesReferenceFilters(
  filters: EmployeesReferenceFilters = {},
): EmployeesReferenceFilters {
  if (filters.activeOnly !== undefined) {
    return filters
  }
  return { ...filters, activeOnly: true }
}

function normalizeCustomersReferenceFilters(
  filters: CustomersReferenceFilters = {},
): CustomersReferenceFilters {
  if (filters.activeOnly !== undefined) {
    return filters
  }
  return { ...filters, activeOnly: true }
}

export function customersReferenceQueryKey(
  filters: CustomersReferenceFilters = {},
): readonly ['customers', 'reference', CustomersReferenceFilters] {
  return ['customers', 'reference', normalizeCustomersReferenceFilters(filters)] as const
}

export function customersReferenceOptions(filters: CustomersReferenceFilters = {}) {
  const normalized = normalizeCustomersReferenceFilters(filters)
  return queryOptions({
    queryKey: customersReferenceQueryKey(normalized),
    queryFn: () =>
      fetchAllReferencePages<CustomerListItem>('/api/customers', {
        activeOnly: normalized.activeOnly ?? true,
        kind: normalized.kind,
        search: normalized.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

export function claimSourcesReferenceQueryKey(
  filters: ReferenceLookupFilters = {},
): readonly ['claim-sources', 'reference', ReferenceLookupFilters] {
  return ['claim-sources', 'reference', normalizeReferenceLookupFilters(filters)] as const
}

export function claimSourcesReferenceOptions(filters: ReferenceLookupFilters = {}) {
  const normalized = normalizeReferenceLookupFilters(filters)
  return queryOptions({
    queryKey: claimSourcesReferenceQueryKey(normalized),
    queryFn: () =>
      fetchAllReferencePages<ClaimSourceListItem>('/api/claim-sources', {
        activeOnly: normalized.activeOnly ?? true,
        search: normalized.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

export function engineTypesReferenceQueryKey(
  filters: EngineTypesReferenceFilters = {},
): readonly ['engine-types', 'reference', EngineTypesReferenceFilters] {
  return ['engine-types', 'reference', normalizeEngineTypesReferenceFilters(filters)] as const
}

function normalizeEngineTypesReferenceFilters(
  filters: EngineTypesReferenceFilters = {},
): EngineTypesReferenceFilters {
  if (filters.activeOnly !== undefined) {
    return filters
  }
  return { ...filters, activeOnly: true }
}

export function engineTypesReferenceOptions(filters: EngineTypesReferenceFilters = {}) {
  const normalized = normalizeEngineTypesReferenceFilters(filters)
  return queryOptions({
    queryKey: engineTypesReferenceQueryKey(normalized),
    // Full catalog for <select> dropdowns; seed data is small (one page). Search-as-you-type is future work.
    queryFn: () =>
      fetchAllReferencePages<EngineTypeListItem>('/api/engine-types', {
        activeOnly: normalized.activeOnly ?? true,
        search: normalized.search,
        manufacturerId: normalized.manufacturerId,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

export function engineManufacturersReferenceQueryKey(
  filters: ReferenceLookupFilters = {},
): readonly ['engine-manufacturers', 'reference', ReferenceLookupFilters] {
  return ['engine-manufacturers', 'reference', normalizeReferenceLookupFilters(filters)] as const
}

export function engineManufacturersReferenceOptions(filters: ReferenceLookupFilters = {}) {
  const normalized = normalizeReferenceLookupFilters(filters)
  return queryOptions({
    queryKey: engineManufacturersReferenceQueryKey(normalized),
    queryFn: () =>
      fetchAllReferencePages<EngineManufacturerListItem>('/api/engine-manufacturers', {
        activeOnly: normalized.activeOnly ?? true,
        search: normalized.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

export function employeesReferenceQueryKey(
  filters: EmployeesReferenceFilters = {},
): readonly ['employees', 'reference', EmployeesReferenceFilters] {
  return ['employees', 'reference', normalizeEmployeesReferenceFilters(filters)] as const
}

export function employeesReferenceOptions(filters: EmployeesReferenceFilters = {}) {
  const normalized = normalizeEmployeesReferenceFilters(filters)
  return queryOptions({
    queryKey: employeesReferenceQueryKey(normalized),
    queryFn: () =>
      fetchAllReferencePages<EmployeeListItem>('/api/employees', {
        activeOnly: normalized.activeOnly ?? true,
        search: normalized.search,
        departmentId: normalized.departmentId,
        assignableOnly: normalized.assignableOnly,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

/**
 * Workers eligible to be a claim's "assigned worker" — those whose department is
 * flagged `providesAssignedWorkers` (Sklapanje by default, admin-configurable).
 * Fault attribution deliberately uses the unfiltered `employeesReferenceOptions`.
 */
export function assignedWorkerReferenceOptions() {
  return employeesReferenceOptions({ activeOnly: true, assignableOnly: true })
}

export function departmentsReferenceQueryKey(
  filters: ReferenceLookupFilters = {},
): readonly ['departments', 'reference', ReferenceLookupFilters] {
  return ['departments', 'reference', normalizeReferenceLookupFilters(filters)] as const
}

export function departmentsReferenceOptions(filters: ReferenceLookupFilters = {}) {
  const normalized = normalizeReferenceLookupFilters(filters)
  return queryOptions({
    queryKey: departmentsReferenceQueryKey(normalized),
    queryFn: () =>
      fetchAllReferencePages<DepartmentListItem>('/api/departments', {
        activeOnly: normalized.activeOnly ?? true,
        search: normalized.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

export function externalPartiesReferenceQueryKey(
  filters: ReferenceLookupFilters = {},
): readonly ['external-parties', 'reference', ReferenceLookupFilters] {
  return ['external-parties', 'reference', normalizeReferenceLookupFilters(filters)] as const
}

export function externalPartiesReferenceOptions(filters: ReferenceLookupFilters = {}) {
  const normalized = normalizeReferenceLookupFilters(filters)
  return queryOptions({
    queryKey: externalPartiesReferenceQueryKey(normalized),
    queryFn: () =>
      fetchAllReferencePages<ExternalPartyListItem>('/api/external-parties', {
        activeOnly: normalized.activeOnly ?? true,
        search: normalized.search,
      }),
    staleTime: REFERENCE_STALE_MS,
    gcTime: REFERENCE_GC_MS,
  })
}

/** Prefetch shared catalog data once for claim list, detail edit, and create flows. */
export async function prefetchClaimEditReferences(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.ensureQueryData(departmentsReferenceOptions(ACTIVE_REFERENCE_LOOKUP)),
    queryClient.ensureQueryData(employeesReferenceOptions(ACTIVE_REFERENCE_LOOKUP)),
    // Assigned-worker field uses a distinct (assembly-only) key — warm it too, else
    // the create/edit forms flash a skeleton on open waiting for this one query.
    queryClient.ensureQueryData(assignedWorkerReferenceOptions()),
    queryClient.ensureQueryData(externalPartiesReferenceOptions(ACTIVE_REFERENCE_LOOKUP)),
    queryClient.ensureQueryData(engineTypesReferenceOptions(ACTIVE_REFERENCE_LOOKUP)),
    queryClient.ensureQueryData(engineManufacturersReferenceOptions(ACTIVE_REFERENCE_LOOKUP)),
    queryClient.ensureQueryData(customersReferenceOptions(EMOTIVE_PARTNER_CUSTOMERS_REFERENCE)),
  ])
}
