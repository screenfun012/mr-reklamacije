import { m } from '@mr/i18n'
import {
  engineManufacturersReferenceOptions,
  ResourceCatalogStatusFilter,
  useDebouncedValue,
  type ResourceCatalogSearch,
} from '@mr/shared'
import { FilterSelect, Input, panelClassName, SearchableSelect } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { useLocale } from '@mr/ui'

const SEARCH_DEBOUNCE_MS = 300

export interface ResourceListToolbarProps {
  search: ResourceCatalogSearch
  onSearchChange: (next: ResourceCatalogSearch) => void
  showManufacturerFilter?: boolean
}

function ResourceManufacturerFilter({
  search,
  onSearchChange,
}: Pick<ResourceListToolbarProps, 'search' | 'onSearchChange'>): React.ReactElement {
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: false }),
  )

  return (
    <SearchableSelect
      value={search.manufacturerId ?? ''}
      options={manufacturers.map((item) => ({
        value: item.id,
        label: item.name,
        keywords: item.code,
      }))}
      placeholder={m.admin_catalog_filter_manufacturer_all()}
      searchPlaceholder={m.field_search_placeholder()}
      emptyOptionLabel={m.admin_catalog_filter_manufacturer_all()}
      noResultsLabel={m.field_no_results()}
      aria-label={m.field_manufacturer()}
      className="w-full sm:w-[14rem]"
      onValueChange={(value) => {
        onSearchChange({
          ...search,
          manufacturerId: value === '' ? undefined : value,
          page: 1,
        })
      }}
    />
  )
}

export function ResourceListToolbar({
  search,
  onSearchChange,
  showManufacturerFilter = false,
}: ResourceListToolbarProps): React.ReactElement {
  const { locale } = useLocale()
  const [searchDraft, setSearchDraft] = useState(search.q ?? '')
  const debouncedQuery = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS)

  const statusOptions = useMemo(
    () => [
      { value: ResourceCatalogStatusFilter.All, label: m.admin_catalog_filter_all() },
      { value: ResourceCatalogStatusFilter.Active, label: m.admin_catalog_filter_active() },
      { value: ResourceCatalogStatusFilter.Inactive, label: m.admin_catalog_filter_inactive() },
    ],
    [locale],
  )

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
    // Wrapped, not spread. internal-web's filter card carries six controls, so `justify-between`
    // fills it; a catalogue has two or three and the same rule left a search box on one edge, a
    // select on the other, and a thousand pixels of nothing between them — which read as an empty
    // bar rather than as a filter.
    <div className={`${panelClassName} flex flex-wrap items-center gap-3 p-5`}>
      <Input
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        placeholder={m.admin_catalog_search_placeholder()}
        aria-label={m.admin_catalog_search_placeholder()}
        className="w-full sm:w-[18rem]"
      />

      <div className="flex flex-1 flex-wrap items-center gap-3">
        {showManufacturerFilter ? (
          <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
            <ResourceManufacturerFilter search={search} onSearchChange={onSearchChange} />
          </Suspense>
        ) : null}

        <FilterSelect
          value={search.status}
          options={statusOptions}
          placeholder={m.admin_catalog_filter_all()}
          aria-label={m.admin_catalog_filter_status()}
          className="w-full sm:w-[12rem]"
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
        />
      </div>
    </div>
  )
}
