import { ClaimSortBy, ClaimSortDir, type ClaimsSearch } from '@mr/shared'
import type { SortingState } from '@tanstack/react-table'

export type SortableClaimColumnId = typeof ClaimSortBy.DateOfClaim | typeof ClaimSortBy.DateOfFinish

export function isSortableClaimColumnId(columnId: string): columnId is SortableClaimColumnId {
  return columnId === ClaimSortBy.DateOfClaim || columnId === ClaimSortBy.DateOfFinish
}

export function createNextSortSearch(
  search: ClaimsSearch,
  columnId: SortableClaimColumnId,
): ClaimsSearch {
  const isActive = search.sortBy === columnId
  const nextDir =
    isActive && search.sortDir === ClaimSortDir.Asc ? ClaimSortDir.Desc : ClaimSortDir.Asc

  return {
    ...search,
    sortBy: columnId,
    sortDir: nextDir,
    page: 1,
  }
}

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
