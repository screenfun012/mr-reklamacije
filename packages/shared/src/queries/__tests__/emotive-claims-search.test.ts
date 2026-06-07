import { describe, expect, it } from 'vitest'

import { emotiveClaimsListQueryKey } from '../emotive-claims.js'
import {
  emotiveClaimsFiltersFromSearch,
  emotiveClaimsListQueryKeyFromSearch,
  emotiveClaimsPaginationFromSearch,
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
        page: 2,
        pageSize: 25,
      }),
    ).toEqual({
      outcome: 'pending',
      search: 'turbo',
      dateFrom: new Date('2026-04-17T00:00:00.000Z'),
      dateTo: new Date('2026-05-01T00:00:00.000Z'),
    })
  })
})

describe('emotiveClaimsPaginationFromSearch', () => {
  it('extracts page and pageSize from search params', () => {
    expect(emotiveClaimsPaginationFromSearch({ page: 3, pageSize: 25 })).toEqual({
      page: 3,
      pageSize: 25,
    })
  })
})

describe('emotiveClaimsListQueryKeyFromSearch', () => {
  it('produces the same query key as filters derived from search', () => {
    const search = {
      outcome: 'accepted' as const,
      search: 'oil leak',
      page: 2,
      pageSize: 10 as const,
    }
    const fromSearch = emotiveClaimsListQueryKeyFromSearch(search)
    const fromFilters = emotiveClaimsListQueryKey(emotiveClaimsFiltersFromSearch(search), 2, 10)

    expect(fromSearch).toEqual(fromFilters)
  })

  it('changes query key when search filters change', () => {
    const pending = emotiveClaimsListQueryKeyFromSearch({
      outcome: 'pending',
      page: 1,
      pageSize: 10,
    })
    const accepted = emotiveClaimsListQueryKeyFromSearch({
      outcome: 'accepted',
      page: 1,
      pageSize: 10,
    })

    expect(pending).not.toEqual(accepted)
  })
})

describe('emotiveClaimsSearchFromFilters', () => {
  it('round-trips search params through filters', () => {
    const filters = emotiveClaimsFiltersFromSearch({
      outcome: 'rejected',
      dateFrom: '2026-01-15',
      page: 2,
      pageSize: 25,
    })

    expect(emotiveClaimsSearchFromFilters(filters, { page: 2, pageSize: 25 })).toEqual({
      outcome: 'rejected',
      dateFrom: '2026-01-15',
      page: 2,
      pageSize: 25,
    })
  })
})
