import { describe, expect, it } from 'vitest'

import { ClaimSortBy, ClaimSortDir } from '../../schemas/claim-list.schema.js'
import { claimKeys } from '../claim-keys.js'
import { claimsListOptions, claimsListQueryKey, normalizeClaimsListFilters } from '../claims.js'
import { serializeEmotiveClaimsListParams } from '../serialize-search-params.js'
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

describe('the category filter, from the URL to the request', () => {
  // The select, the URL schema and the API each handled categoryCode and each had a test; the one
  // step that joins them — search → filters — dropped it, so the list ignored the filter for four
  // days while everything around it was green. This test walks the exact chain the route loader
  // walks.
  it('carries categoryCode from the search into the filters, the query key and the params', () => {
    const search = ClaimsSearchSchema.parse({
      categoryCode: 'MASINSKA_OBRADA',
      page: 1,
      pageSize: 10,
    })

    const filters = claimsFiltersFromSearch(search)
    expect(filters.categoryCode).toBe('MASINSKA_OBRADA')

    const options = claimsListOptions(filters, 1, 10)
    expect(JSON.stringify(options.queryKey)).toContain('MASINSKA_OBRADA')

    const params = serializeEmotiveClaimsListParams({
      ...normalizeClaimsListFilters(filters),
      page: 1,
      pageSize: 10,
    })
    expect(params).toContain('categoryCode=MASINSKA_OBRADA')
  })

  it('survives the round trip back into a search', () => {
    const search = claimsSearchFromFilters(
      { categoryCode: 'NOVI_DELOVI', outcome: 'pending' },
      { page: 2, pageSize: 25 },
    )

    expect(search.categoryCode).toBe('NOVI_DELOVI')
    expect(search.outcome).toBe('pending')
  })
})

describe('the engine-type filter, from the URL to the request', () => {
  // Same chain, same reason as the category test above: search → filters is the one step
  // where a URL-only filter can silently die while every layer around it stays green.
  const ENGINE_TYPE_ID = 'e1111111-1111-4111-8111-111111111111'

  it('carries engineTypeId from the search into the filters, the query key and the params', () => {
    const search = ClaimsSearchSchema.parse({
      engineTypeId: ENGINE_TYPE_ID,
      page: 1,
      pageSize: 10,
    })

    const filters = claimsFiltersFromSearch(search)
    expect(filters.engineTypeId).toBe(ENGINE_TYPE_ID)

    const options = claimsListOptions(filters, 1, 10)
    expect(JSON.stringify(options.queryKey)).toContain(ENGINE_TYPE_ID)

    const params = serializeEmotiveClaimsListParams({
      ...normalizeClaimsListFilters(filters),
      page: 1,
      pageSize: 10,
    })
    expect(params).toContain(`engineTypeId=${ENGINE_TYPE_ID}`)
  })

  it('survives the round trip back into a search', () => {
    const search = claimsSearchFromFilters(
      { engineTypeId: ENGINE_TYPE_ID, manufacturerId: 'a1111111-1111-4111-8111-111111111111' },
      { page: 1, pageSize: 10 },
    )

    expect(search.engineTypeId).toBe(ENGINE_TYPE_ID)
    expect(search.manufacturerId).toBe('a1111111-1111-4111-8111-111111111111')
  })
})
