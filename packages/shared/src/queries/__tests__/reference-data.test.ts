import { describe, expect, it } from 'vitest'

import {
  claimSourcesReferenceOptions,
  claimSourcesReferenceQueryKey,
  customersReferenceOptions,
  customersReferenceQueryKey,
  engineTypesReferenceOptions,
  engineTypesReferenceQueryKey,
} from '../reference-data.js'

describe('reference query options', () => {
  it('uses infinite stale time for customer lookups', () => {
    const options = customersReferenceOptions({ kind: 'emotive_partner' })
    expect(customersReferenceQueryKey({ kind: 'emotive_partner' })).toEqual([
      'customers',
      'reference',
      { kind: 'emotive_partner' },
    ])
    expect(options.staleTime).toBe(Number.POSITIVE_INFINITY)
    expect(options.gcTime).toBe(Number.POSITIVE_INFINITY)
  })

  it('uses stable keys for claim sources and engine types', () => {
    expect(claimSourcesReferenceQueryKey({ search: 'oem' })).toEqual([
      'claim-sources',
      'reference',
      { search: 'oem' },
    ])
    expect(engineTypesReferenceQueryKey()).toEqual(['engine-types', 'reference', {}])
    expect(claimSourcesReferenceOptions().queryKey[0]).toBe('claim-sources')
    expect(engineTypesReferenceOptions().queryKey[0]).toBe('engine-types')
  })
})
