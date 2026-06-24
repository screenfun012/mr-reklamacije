import { ClaimSortBy, ClaimSortDir } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  claimsTableSortingFromSearch,
  createNextSortSearch,
  isSortableClaimColumnId,
  sortableColumnAriaSort,
} from '../claims-table-sort.js'

describe('isSortableClaimColumnId', () => {
  it('accepts whitelisted claim sort columns only', () => {
    expect(isSortableClaimColumnId(ClaimSortBy.DateOfClaim)).toBe(true)
    expect(isSortableClaimColumnId(ClaimSortBy.DateOfFinish)).toBe(true)
    expect(isSortableClaimColumnId('mrNumber')).toBe(false)
  })
})

describe('createNextSortSearch', () => {
  it('starts ascending sort and resets page when column is inactive', () => {
    expect(
      createNextSortSearch({ outcome: 'pending', page: 3, pageSize: 25 }, ClaimSortBy.DateOfClaim),
    ).toEqual({
      outcome: 'pending',
      page: 1,
      pageSize: 25,
      sortBy: 'dateOfClaim',
      sortDir: 'asc',
    })
  })

  it('toggles active column between asc and desc', () => {
    expect(
      createNextSortSearch(
        {
          sortBy: ClaimSortBy.DateOfFinish,
          sortDir: ClaimSortDir.Asc,
          page: 1,
          pageSize: 10,
        },
        ClaimSortBy.DateOfFinish,
      ),
    ).toEqual({
      page: 1,
      pageSize: 10,
      sortBy: 'dateOfFinish',
      sortDir: 'desc',
    })
  })
})

describe('claimsTableSortingFromSearch', () => {
  it('maps URL sort params to TanStack sorting state', () => {
    expect(
      claimsTableSortingFromSearch({
        sortBy: ClaimSortBy.DateOfClaim,
        sortDir: ClaimSortDir.Asc,
        page: 1,
        pageSize: 10,
      }),
    ).toEqual([{ id: 'dateOfClaim', desc: false }])
  })

  it('returns empty sorting when URL has no sort params', () => {
    expect(claimsTableSortingFromSearch({ page: 1, pageSize: 10 })).toEqual([])
  })
})

describe('sortableColumnAriaSort', () => {
  it('maps TanStack sort direction to aria-sort values', () => {
    expect(sortableColumnAriaSort(false)).toBe('none')
    expect(sortableColumnAriaSort('asc')).toBe('ascending')
    expect(sortableColumnAriaSort('desc')).toBe('descending')
  })
})
