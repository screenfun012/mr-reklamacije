import {
  claimCategoryCountsOptions,
  claimsFiltersFromSearch,
  claimsListOptions,
  claimsPaginationFromSearch,
  claimsSortFromSearch,
  type ClaimsSearch,
  type ListPageSize,
} from '@mr/shared'
import { ListPagination } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { ClaimsFilters } from './claims-filters'
import { ClaimsListHeader } from './claims-list-header'
import { ClaimsCategoryEmpty, ClaimsFilterEmpty } from './claims-list-empty'
import { isCategoryEmpty, type ClaimsListMode } from './claims-list-mode'
import { ClaimsTable } from './claims-table'
import { writeRememberedPageSize } from './remembered-page-size'

export interface ClaimsListContentProps {
  search: ClaimsSearch
  onSearchChange: (next: ClaimsSearch) => void
  mode: ClaimsListMode
  canCreateEmotive: boolean
  canCreateDomace: boolean
  /** Leaving a category's list for the list of everything, filters intact. */
  onLeaveCategory: (next: ClaimsSearch) => void
}

export function ClaimsListContent({
  search,
  onSearchChange,
  mode,
  canCreateEmotive,
  canCreateDomace,
  onLeaveCategory,
}: ClaimsListContentProps) {
  // In category mode the code comes from the PATH: it is the place, not a filter, and the
  // filter bar has no control for it.
  const filters =
    mode.kind === 'category'
      ? { ...claimsFiltersFromSearch(search), categoryCode: mode.code }
      : claimsFiltersFromSearch(search)
  const { page, pageSize } = claimsPaginationFromSearch(search)
  const sort = claimsSortFromSearch(search)

  const { data } = useSuspenseQuery(claimsListOptions(filters, page, pageSize, sort))
  const { data: counts } = useSuspenseQuery(claimCategoryCountsOptions())

  const handleSearchChange = useCallback(
    (next: ClaimsSearch) => {
      onSearchChange(next)
    },
    [onSearchChange],
  )

  const handlePageChange = useCallback(
    (nextPage: number) => {
      onSearchChange({ ...search, page: nextPage })
    },
    [onSearchChange, search],
  )

  const handlePageSizeChange = useCallback(
    (nextPageSize: ListPageSize) => {
      writeRememberedPageSize(nextPageSize)
      onSearchChange({ ...search, page: 1, pageSize: nextPageSize })
    },
    [onSearchChange, search],
  )

  const showCategoryEmpty = mode.kind === 'category' && isCategoryEmpty(search, data.total)
  const showFilterEmpty = !showCategoryEmpty && data.items.length === 0

  return (
    <div className="flex flex-col gap-6">
      <ClaimsListHeader
        mode={mode}
        pendingTotal={counts.totals.pending}
        canCreateEmotive={canCreateEmotive}
        canCreateDomace={canCreateDomace}
      />
      <ClaimsFilters
        search={search}
        onSearchChange={handleSearchChange}
        mode={mode}
        onLeaveCategory={onLeaveCategory}
      />
      {showCategoryEmpty ? (
        <ClaimsCategoryEmpty
          categoryCode={mode.kind === 'category' ? mode.code : undefined}
          canCreate={canCreateEmotive || canCreateDomace}
        />
      ) : null}
      {showFilterEmpty ? (
        <ClaimsFilterEmpty
          onClear={() =>
            handleSearchChange({ page: 1, pageSize: search.pageSize ?? 10 } as ClaimsSearch)
          }
        />
      ) : null}
      {showCategoryEmpty || showFilterEmpty ? null : (
        <>
          <ClaimsTable
            categoryName={mode.kind === 'category' ? (mode.category?.name ?? mode.code) : undefined}
            items={data.items}
            total={data.total}
            search={search}
            onSearchChange={handleSearchChange}
            showCategoryColumn={mode.kind === 'all'}
            categoryCode={mode.kind === 'category' ? mode.code : undefined}
          />
          <ListPagination
            total={data.total}
            page={data.page}
            pageSize={data.pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  )
}
