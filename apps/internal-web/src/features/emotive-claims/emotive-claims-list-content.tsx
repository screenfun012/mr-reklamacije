import {
  emotiveClaimsFiltersFromSearch,
  emotiveClaimsListOptions,
  emotiveClaimsPaginationFromSearch,
  type EmotiveClaimsSearch,
} from '@mr/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { EmotiveClaimsFilters } from './emotive-claims-filters'
import { EmotiveClaimsPagination } from './emotive-claims-pagination'
import { EmotiveClaimsTable } from './emotive-claims-table'

export interface EmotiveClaimsListContentProps {
  search: EmotiveClaimsSearch
  onSearchChange: (next: EmotiveClaimsSearch) => void
}

export function EmotiveClaimsListContent({
  search,
  onSearchChange,
}: EmotiveClaimsListContentProps) {
  const filters = emotiveClaimsFiltersFromSearch(search)
  const { page, pageSize } = emotiveClaimsPaginationFromSearch(search)

  const { data } = useSuspenseQuery(emotiveClaimsListOptions(filters, page, pageSize))

  const handleSearchChange = useCallback(
    (next: EmotiveClaimsSearch) => {
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
      <EmotiveClaimsFilters search={search} onSearchChange={handleSearchChange} />
      <EmotiveClaimsTable items={data.items} total={data.total} />
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
