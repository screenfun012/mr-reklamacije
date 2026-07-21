import {
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
import { ClaimsTable } from './claims-table'
import { writeRememberedPageSize } from './remembered-page-size'

export interface ClaimsListContentProps {
  search: ClaimsSearch
  onSearchChange: (next: ClaimsSearch) => void
}

export function ClaimsListContent({ search, onSearchChange }: ClaimsListContentProps) {
  const filters = claimsFiltersFromSearch(search)
  const { page, pageSize } = claimsPaginationFromSearch(search)
  const sort = claimsSortFromSearch(search)

  const { data } = useSuspenseQuery(claimsListOptions(filters, page, pageSize, sort))

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

  return (
    <div className="flex flex-col gap-6">
      <ClaimsFilters search={search} onSearchChange={handleSearchChange} />
      <ClaimsTable
        items={data.items}
        total={data.total}
        search={search}
        onSearchChange={handleSearchChange}
      />
      <ListPagination
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
