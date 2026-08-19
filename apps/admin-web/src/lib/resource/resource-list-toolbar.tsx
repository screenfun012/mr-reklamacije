import { m } from '@mr/i18n'
import {
  engineManufacturersReferenceOptions,
  ResourceCatalogStatusFilter,
  useDebouncedValue,
  type ResourceCatalogSearch,
} from '@mr/shared'
import { cn, panelClassName, SearchableSelect } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
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
    <div className={`${panelClassName} flex flex-wrap items-center gap-3 px-4 py-3.5`}>
      {/* Three states, three visible buttons. As a dropdown the current filter was a word inside a
          control you had to open to see the alternatives; here the whole choice is on the screen and
          costs one tap. */}
      <div
        className="flex flex-none overflow-hidden rounded-[9px] border border-mr-border-strong"
        role="group"
        aria-label={m.admin_catalog_filter_status()}
      >
        {statusOptions.map((option) => {
          const active = option.value === search.status
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              className={cn(
                'cursor-pointer px-[15px] py-2.5 text-[11.5px] font-extrabold tracking-[0.05em] transition-colors',
                active
                  ? 'bg-mr-brand text-white'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => {
                onSearchChange({ ...search, status: option.value, page: 1 })
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <label className="flex h-10 w-full max-w-[360px] flex-1 items-center gap-2.5 rounded-[9px] border border-mr-border-strong bg-adm-inbg px-3">
        <Search className="size-3.5 flex-none text-muted-foreground" aria-hidden="true" />
        <input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder={m.admin_catalog_search_placeholder()}
          aria-label={m.admin_catalog_search_placeholder()}
          className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
      </label>

      {showManufacturerFilter ? (
        <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
          <ResourceManufacturerFilter search={search} onSearchChange={onSearchChange} />
        </Suspense>
      ) : null}
    </div>
  )
}
