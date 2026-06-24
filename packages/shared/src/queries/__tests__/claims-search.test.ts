import { describe, expect, it } from 'vitest'

import { ClaimSortBy, ClaimSortDir } from '../../schemas/claim-list.schema.js'
import { claimKeys } from '../claim-keys.js'
import { claimsListQueryKey } from '../claims.js'
import {
  ClaimsSearchSchema,
  claimsFiltersFromSearch,
  claimsListQueryKeyFromSearch,
  claimsPaginationFromSearch,
  claimsSearchFromFilters,
  claimsSortFromSearch,
} from '../claims-search.js'

describe('ClaimsSearchSchema', () => {
  it('accepts optional sortBy and sortDir URL params', () => {
    const parsed = ClaimsSearchSchema.parse({
      sortBy: ClaimSortBy.DateOfFinish,
      sortDir: ClaimSortDir.Desc,
      page: 1,
      pageSize: 10,
    })

    expect(parsed.sortBy).toBe('dateOfFinish')
    expect(parsed.sortDir).toBe('desc')
  })

  it('rejects invalid sortBy values in URL search', () => {
    expect(() =>
      ClaimsSearchSchema.parse({
        sortBy: 'date_of_claim; DROP TABLE emotive_claims',
        page: 1,
        pageSize: 10,
      }),
    ).toThrow()
  })
})

describe('claimsSortFromSearch', () => {
  it('extracts sort params without affecting filters', () => {
    expect(
      claimsSortFromSearch({
        sortBy: ClaimSortBy.DateOfClaim,
        sortDir: ClaimSortDir.Asc,
        page: 1,
        pageSize: 10,
      }),
    ).toEqual({
      sortBy: 'dateOfClaim',
      sortDir: 'asc',
    })

    expect(
      claimsFiltersFromSearch({
        sortBy: ClaimSortBy.DateOfClaim,
        sortDir: ClaimSortDir.Asc,
        outcome: 'pending',
        page: 1,
        pageSize: 10,
      }),
    ).toEqual({
      outcome: 'pending',
    })
  })

  it('returns empty sort when URL has no sort params', () => {
    expect(claimsSortFromSearch({ page: 1, pageSize: 10 })).toEqual({})
  })
})

describe('claimsListQueryKeyFromSearch', () => {
  it('produces the same query key as filters, pagination, and sort derived from search', () => {
    const search = {
      outcome: 'accepted' as const,
      sortBy: ClaimSortBy.DateOfFinish,
      sortDir: ClaimSortDir.Asc,
      page: 2,
      pageSize: 10 as const,
    }
    const fromSearch = claimsListQueryKeyFromSearch(search)
    const fromParts = claimsListQueryKey(
      claimsFiltersFromSearch(search),
      claimsPaginationFromSearch(search).page,
      claimsPaginationFromSearch(search).pageSize,
      claimsSortFromSearch(search),
    )

    expect(fromSearch).toEqual(fromParts)
  })

  it('changes query key when sort params change', () => {
    const defaultSort = claimsListQueryKeyFromSearch({ page: 1, pageSize: 10 })
    const dateOfClaimAsc = claimsListQueryKeyFromSearch({
      sortBy: ClaimSortBy.DateOfClaim,
      sortDir: ClaimSortDir.Asc,
      page: 1,
      pageSize: 10,
    })
    const dateOfFinishDesc = claimsListQueryKeyFromSearch({
      sortBy: ClaimSortBy.DateOfFinish,
      sortDir: ClaimSortDir.Desc,
      page: 1,
      pageSize: 10,
    })

    expect(defaultSort).not.toEqual(dateOfClaimAsc)
    expect(dateOfClaimAsc).not.toEqual(dateOfFinishDesc)
  })

  it('keeps filter-only query key unchanged when sort is absent', () => {
    const search = { outcome: 'pending' as const, page: 1, pageSize: 10 as const }
    const fromSearch = claimsListQueryKeyFromSearch(search)
    const fromFilters = claimKeys.list(claimsFiltersFromSearch(search), 1, 10)

    expect(fromSearch).toEqual(fromFilters)
  })
})

describe('claimsSearchFromFilters', () => {
  it('round-trips sort params through filters', () => {
    const filters = claimsFiltersFromSearch({
      outcome: 'rejected',
      dateFrom: '2026-01-15',
      page: 2,
      pageSize: 25,
    })
    const sort = claimsSortFromSearch({
      sortBy: ClaimSortBy.DateOfClaim,
      sortDir: ClaimSortDir.Desc,
      page: 2,
      pageSize: 25,
    })

    expect(claimsSearchFromFilters(filters, { page: 2, pageSize: 25 }, sort)).toEqual({
      outcome: 'rejected',
      dateFrom: '2026-01-15',
      sortBy: 'dateOfClaim',
      sortDir: 'desc',
      page: 2,
      pageSize: 25,
    })
  })
})
