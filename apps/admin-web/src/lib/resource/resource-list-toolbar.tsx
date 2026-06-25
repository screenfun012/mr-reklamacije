import { m } from '@mr/i18n'
import {
  ResourceCatalogStatusFilter,
  useDebouncedValue,
  type ResourceCatalogSearch,
} from '@mr/shared'
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mr/ui'
import { useEffect, useState } from 'react'

const SEARCH_DEBOUNCE_MS = 300

export interface ResourceListToolbarProps {
  search: ResourceCatalogSearch
  onSearchChange: (next: ResourceCatalogSearch) => void
}

export function ResourceListToolbar({
  search,
  onSearchChange,
}: ResourceListToolbarProps): React.ReactElement {
  const [searchDraft, setSearchDraft] = useState(search.q ?? '')
  const debouncedQuery = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    setSearchDraft(search.q ?? '')
  }, [search.q])

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    const nextQuery = trimmed.length > 0 ? trimmed : undefined
    if (nextQuery === search.q) {
      return
    }

    onSearchChange({
      ...search,
      q: nextQuery,
      page: 1,
    })
  }, [debouncedQuery, onSearchChange, search])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Input
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        placeholder={m.admin_catalog_search_placeholder()}
        aria-label={m.admin_catalog_search_placeholder()}
        className="max-w-md"
      />

      <Select
        value={search.status}
        onValueChange={(value) => {
          if (
            value === ResourceCatalogStatusFilter.All ||
            value === ResourceCatalogStatusFilter.Active ||
            value === ResourceCatalogStatusFilter.Inactive
          ) {
            onSearchChange({
              ...search,
              status: value,
              page: 1,
            })
          }
        }}
      >
        <SelectTrigger className="w-full sm:w-[12rem]" aria-label={m.admin_catalog_filter_status()}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ResourceCatalogStatusFilter.All}>
            {m.admin_catalog_filter_all()}
          </SelectItem>
          <SelectItem value={ResourceCatalogStatusFilter.Active}>
            {m.admin_catalog_filter_active()}
          </SelectItem>
          <SelectItem value={ResourceCatalogStatusFilter.Inactive}>
            {m.admin_catalog_filter_inactive()}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
