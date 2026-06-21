import { describe, expect, it } from 'vitest'

import {
  ACTIVE_REFERENCE_LOOKUP,
  claimSourcesReferenceOptions,
  claimSourcesReferenceQueryKey,
  customersReferenceOptions,
  customersReferenceQueryKey,
  departmentsReferenceOptions,
  departmentsReferenceQueryKey,
  employeesReferenceOptions,
  employeesReferenceQueryKey,
  engineTypesReferenceOptions,
  engineTypesReferenceQueryKey,
  externalPartiesReferenceOptions,
  externalPartiesReferenceQueryKey,
} from '../reference-data.js'

describe('reference query options', () => {
  it('uses infinite stale time for customer lookups', () => {
    const options = customersReferenceOptions({ kind: 'emotive_partner' })
    expect(customersReferenceQueryKey({ kind: 'emotive_partner' })).toEqual([
      'customers',
      'reference',
      { kind: 'emotive_partner', activeOnly: true },
    ])
    expect(options.staleTime).toBe(Number.POSITIVE_INFINITY)
    expect(options.gcTime).toBe(Number.POSITIVE_INFINITY)
  })

  it('uses stable keys for claim sources and engine types', () => {
    expect(claimSourcesReferenceQueryKey({ search: 'oem' })).toEqual([
      'claim-sources',
      'reference',
      { search: 'oem', activeOnly: true },
    ])
    expect(engineTypesReferenceQueryKey()).toEqual([
      'engine-types',
      'reference',
      ACTIVE_REFERENCE_LOOKUP,
    ])
    expect(engineTypesReferenceQueryKey({ activeOnly: true })).toEqual([
      'engine-types',
      'reference',
      ACTIVE_REFERENCE_LOOKUP,
    ])
    expect(claimSourcesReferenceOptions().queryKey[0]).toBe('claim-sources')
    expect(engineTypesReferenceOptions().queryKey[0]).toBe('engine-types')
  })

  it('normalizes empty filters to activeOnly true for shared cache keys', () => {
    expect(departmentsReferenceQueryKey()).toEqual(
      departmentsReferenceQueryKey(ACTIVE_REFERENCE_LOOKUP),
    )
    expect(employeesReferenceQueryKey()).toEqual(
      employeesReferenceQueryKey(ACTIVE_REFERENCE_LOOKUP),
    )
    expect(externalPartiesReferenceQueryKey()).toEqual(
      externalPartiesReferenceQueryKey(ACTIVE_REFERENCE_LOOKUP),
    )
  })

  it('uses infinite stale time for employee, department, and external party lookups', () => {
    expect(employeesReferenceQueryKey({ departmentId: 'dept-1' })).toEqual([
      'employees',
      'reference',
      { departmentId: 'dept-1', activeOnly: true },
    ])
    expect(departmentsReferenceQueryKey()).toEqual([
      'departments',
      'reference',
      ACTIVE_REFERENCE_LOOKUP,
    ])
    expect(externalPartiesReferenceQueryKey({ search: 'acme' })).toEqual([
      'external-parties',
      'reference',
      { search: 'acme', activeOnly: true },
    ])

    for (const options of [
      employeesReferenceOptions(),
      departmentsReferenceOptions(),
      externalPartiesReferenceOptions(),
    ]) {
      expect(options.staleTime).toBe(Number.POSITIVE_INFINITY)
      expect(options.gcTime).toBe(Number.POSITIVE_INFINITY)
    }
  })
})
