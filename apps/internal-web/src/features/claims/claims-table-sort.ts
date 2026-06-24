import { ClaimSortBy, ClaimSortDir, type ClaimsSearch } from '@mr/shared'
import type { SortingState } from '@tanstack/react-table'

export function claimsTableSortingFromSearch(search: ClaimsSearch): SortingState {
  if (search.sortBy === undefined) {
    return []
  }

  return [
    {
      id: search.sortBy,
      desc: search.sortDir !== ClaimSortDir.Asc,
    },
  ]
}

export function claimsSearchFromTableSorting(
  search: ClaimsSearch,
  sorting: SortingState,
): ClaimsSearch | null {
  const active = sorting[0]

  if (active === undefined) {
    return null
  }

  if (active.id !== ClaimSortBy.DateOfClaim && active.id !== ClaimSortBy.DateOfFinish) {
    return null
  }

  return {
    ...search,
    sortBy: active.id,
    sortDir: active.desc ? ClaimSortDir.Desc : ClaimSortDir.Asc,
    page: 1,
  }
}

export function sortableColumnAriaSort(
  sorted: false | 'asc' | 'desc',
): 'none' | 'ascending' | 'descending' {
  if (sorted === 'asc') {
    return 'ascending'
  }

  if (sorted === 'desc') {
    return 'descending'
  }

  return 'none'
}
