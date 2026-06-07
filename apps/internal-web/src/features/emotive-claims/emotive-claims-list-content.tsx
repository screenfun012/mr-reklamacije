import {
  customersReferenceOptions,
  emotiveClaimsFiltersFromSearch,
  emotiveClaimsListOptions,
  engineTypesReferenceOptions,
  type EmotiveClaimsSearch,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button } from '@mr/ui'
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { EmotiveClaimsFilters } from './emotive-claims-filters'
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

  const { data: customers } = useSuspenseQuery(customersReferenceOptions())
  const { data: engineTypes } = useSuspenseQuery(engineTypesReferenceOptions())

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    emotiveClaimsListOptions(filters),
  )

  const items = useMemo(() => data.pages.flatMap((page) => page.items), [data.pages])

  const lookups = useMemo(
    () => ({
      customerNameById: new Map(customers.map((customer) => [customer.id, customer.name])),
      engineCodeById: new Map(engineTypes.map((engine) => [engine.id, engine.code])),
    }),
    [customers, engineTypes],
  )

  const handleSearchChange = useCallback(
    (next: EmotiveClaimsSearch) => {
      onSearchChange(next)
    },
    [onSearchChange],
  )

  return (
    <div className="flex flex-col gap-6">
      <EmotiveClaimsFilters search={search} onSearchChange={handleSearchChange} />
      <EmotiveClaimsTable items={items} lookups={lookups} />
      {hasNextPage ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? m.common_loading() : m.emotive_claims_load_more()}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
