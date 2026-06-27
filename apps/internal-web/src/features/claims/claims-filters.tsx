import {
  CLAIM_KIND_REGISTRY,
  engineManufacturersReferenceOptions,
  OUTCOME_REGISTRY,
  useDebouncedValue,
  type ClaimsSearch,
  type OutcomeLabelKey,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { DatePicker, FilterSelect, Input, SearchableSelect } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { FILTER_ALL_SENTINEL } from '~/features/filters/filter-sentinel'
import { useLocale } from '~/lib/locale'

const SEARCH_DEBOUNCE_MS = 300

const OUTCOME_LABELS: Record<OutcomeLabelKey, () => string> = {
  outcome_pending: () => m.outcome_pending(),
  outcome_accepted: () => m.outcome_accepted(),
  outcome_rejected: () => m.outcome_rejected(),
  outcome_archived: () => m.outcome_archived(),
}

const KIND_FILTER_LABELS = {
  all: () => m.claims_filter_kind_all(),
  domace: () => m.claims_filter_kind_domace(),
  emotive: () => m.claims_filter_kind_emotive(),
} as const

export interface ClaimsFiltersProps {
  search: ClaimsSearch
  onSearchChange: (next: ClaimsSearch) => void
}

export function ClaimsFilters({ search, onSearchChange }: ClaimsFiltersProps) {
  const { locale } = useLocale()
  const [searchDraft, setSearchDraft] = useState(search.search ?? '')
  const debouncedSearch = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS)
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )

  const kindOptions = useMemo(
    () => [
      { value: FILTER_ALL_SENTINEL, label: KIND_FILTER_LABELS.all() },
      ...CLAIM_KIND_REGISTRY.map((definition) => ({
        value: definition.key,
        label:
          definition.key === 'domace' ? KIND_FILTER_LABELS.domace() : KIND_FILTER_LABELS.emotive(),
      })),
    ],
    [locale],
  )

  const outcomeOptions = useMemo(
    () => [
      { value: FILTER_ALL_SENTINEL, label: m.emotive_claims_filter_outcome_all() },
      ...OUTCOME_REGISTRY.map((definition) => ({
        value: definition.key,
        label: OUTCOME_LABELS[definition.labelKey](),
      })),
    ],
    [locale],
  )

  const manufacturerOptions = useMemo(
    () =>
      manufacturers.map((manufacturer) => ({
        value: manufacturer.id,
        label: manufacturer.name,
        keywords: manufacturer.code,
      })),
    [manufacturers],
  )

  useEffect(() => {
    setSearchDraft(search.search ?? '')
  }, [search.search])

  useEffect(() => {
    const trimmed = debouncedSearch.trim()
    const nextSearch = trimmed.length > 0 ? trimmed : undefined
    if (nextSearch === search.search) {
      return
    }

    onSearchChange({
      ...search,
      search: nextSearch,
      page: 1,
    })
  }, [debouncedSearch, onSearchChange, search])

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <FilterSelect
        label={m.claims_filter_kind()}
        value={search.kind ?? FILTER_ALL_SENTINEL}
        options={kindOptions}
        placeholder={KIND_FILTER_LABELS.all()}
        aria-label={m.claims_filter_kind()}
        onValueChange={(value) => {
          onSearchChange({
            ...search,
            kind: value === FILTER_ALL_SENTINEL ? undefined : (value as ClaimsSearch['kind']),
            page: 1,
          })
        }}
      />

      <FilterSelect
        label={m.emotive_claims_filter_outcome()}
        value={search.outcome ?? FILTER_ALL_SENTINEL}
        options={outcomeOptions}
        placeholder={m.emotive_claims_filter_outcome_all()}
        aria-label={m.emotive_claims_filter_outcome()}
        onValueChange={(value) => {
          onSearchChange({
            ...search,
            outcome: value === FILTER_ALL_SENTINEL ? undefined : (value as ClaimsSearch['outcome']),
            page: 1,
          })
        }}
      />

      <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.claims_filter_manufacturer()}</span>
        <SearchableSelect
          value={search.manufacturerId ?? ''}
          options={manufacturerOptions}
          placeholder={m.claims_filter_manufacturer_all()}
          searchPlaceholder={m.field_search_placeholder()}
          emptyOptionLabel={m.claims_filter_manufacturer_all()}
          noResultsLabel={m.field_no_results()}
          aria-label={m.claims_filter_manufacturer()}
          onValueChange={(manufacturerId) => {
            onSearchChange({
              ...search,
              manufacturerId: manufacturerId.length > 0 ? manufacturerId : undefined,
              page: 1,
            })
          }}
        />
      </div>

      <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.emotive_claims_filter_date_from()}</span>
        <DatePicker
          value={search.dateFrom}
          onChange={(dateFrom) => {
            onSearchChange({
              ...search,
              dateFrom,
              page: 1,
            })
          }}
          aria-label={m.emotive_claims_filter_date_from()}
        />
      </div>

      <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.emotive_claims_filter_date_to()}</span>
        <DatePicker
          value={search.dateTo}
          onChange={(dateTo) => {
            onSearchChange({
              ...search,
              dateTo,
              page: 1,
            })
          }}
          aria-label={m.emotive_claims_filter_date_to()}
        />
      </div>

      <label className="flex min-w-[12rem] flex-[2] flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.emotive_claims_filter_search()}</span>
        <Input
          type="search"
          placeholder={m.emotive_claims_filter_search_placeholder()}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </label>
    </div>
  )
}
