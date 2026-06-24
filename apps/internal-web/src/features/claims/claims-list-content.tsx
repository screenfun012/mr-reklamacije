import {
  claimsFiltersFromSearch,
  claimsListOptions,
  claimsPaginationFromSearch,
  claimsSortFromSearch,
  type ClaimsSearch,
} from '@mr/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { EmotiveClaimsPagination } from '~/features/emotive-claims/emotive-claims-pagination'

import { ClaimsFilters } from './claims-filters'
import { ClaimsTable } from './claims-table'

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
    (nextPageSize: 10 | 25 | 50) => {
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
      <EmotiveClaimsPagination
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
