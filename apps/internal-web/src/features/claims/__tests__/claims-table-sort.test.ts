import { ClaimSortBy, ClaimSortDir } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  claimsSearchFromTableSorting,
  claimsTableSortingFromSearch,
  sortableColumnAriaSort,
} from '../claims-table-sort.js'

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

describe('claimsSearchFromTableSorting', () => {
  it('maps table sorting to URL search and resets page', () => {
    expect(
      claimsSearchFromTableSorting({ outcome: 'pending', page: 3, pageSize: 25 }, [
        { id: ClaimSortBy.DateOfFinish, desc: true },
      ]),
    ).toEqual({
      outcome: 'pending',
      page: 1,
      pageSize: 25,
      sortBy: 'dateOfFinish',
      sortDir: 'desc',
    })
  })

  it('rejects unsupported column ids', () => {
    expect(
      claimsSearchFromTableSorting({ page: 1, pageSize: 10 }, [{ id: 'mrNumber', desc: false }]),
    ).toBeNull()
  })
})

describe('sortableColumnAriaSort', () => {
  it('maps TanStack sort direction to aria-sort values', () => {
    expect(sortableColumnAriaSort(false)).toBe('none')
    expect(sortableColumnAriaSort('asc')).toBe('ascending')
    expect(sortableColumnAriaSort('desc')).toBe('descending')
  })
})
