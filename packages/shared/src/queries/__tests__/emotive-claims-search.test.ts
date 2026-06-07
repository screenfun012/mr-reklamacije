import { describe, expect, it } from 'vitest'

import { emotiveClaimsListQueryKey } from '../emotive-claims.js'
import {
  emotiveClaimsFiltersFromSearch,
  emotiveClaimsListQueryKeyFromSearch,
  emotiveClaimsSearchFromFilters,
} from '../emotive-claims-search.js'

describe('emotiveClaimsFiltersFromSearch', () => {
  it('maps URL search params to list filters', () => {
    expect(
      emotiveClaimsFiltersFromSearch({
        outcome: 'pending',
        search: 'turbo',
        dateFrom: '2026-04-17',
        dateTo: '2026-05-01',
      }),
    ).toEqual({
      limit: 50,
      outcome: 'pending',
      search: 'turbo',
      dateFrom: new Date('2026-04-17T00:00:00.000Z'),
      dateTo: new Date('2026-05-01T00:00:00.000Z'),
    })
  })
})

describe('emotiveClaimsListQueryKeyFromSearch', () => {
  it('produces the same query key as filters derived from search', () => {
    const search = { outcome: 'accepted' as const, search: 'oil leak' }
    const fromSearch = emotiveClaimsListQueryKeyFromSearch(search)
    const fromFilters = emotiveClaimsListQueryKey(emotiveClaimsFiltersFromSearch(search))

    expect(fromSearch).toEqual(fromFilters)
  })

  it('changes query key when search filters change', () => {
    const pending = emotiveClaimsListQueryKeyFromSearch({ outcome: 'pending' })
    const accepted = emotiveClaimsListQueryKeyFromSearch({ outcome: 'accepted' })

    expect(pending).not.toEqual(accepted)
  })
})

describe('emotiveClaimsSearchFromFilters', () => {
  it('round-trips search params through filters', () => {
    const filters = emotiveClaimsFiltersFromSearch({
      outcome: 'rejected',
      dateFrom: '2026-01-15',
    })

    expect(emotiveClaimsSearchFromFilters(filters)).toEqual({
      outcome: 'rejected',
      dateFrom: '2026-01-15',
    })
  })
})
