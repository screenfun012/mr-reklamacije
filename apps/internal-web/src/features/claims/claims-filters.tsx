import {
  CLAIM_KIND_REGISTRY,
  engineManufacturersReferenceOptions,
  OUTCOME_REGISTRY,
  useDebouncedValue,
  type ClaimsSearch,
  type OutcomeLabelKey,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { cn, DatePicker, FilterSelect, Input, SearchableSelect } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { INTERNAL_CONTROL_CLASSES, InternalFieldLabel } from '~/components/internal-field'
import { FILTER_ALL_SENTINEL } from '~/features/filters/filter-sentinel'
import { useLocale } from '@mr/ui'

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

  const hasActiveFilters =
    search.kind !== undefined ||
    search.outcome !== undefined ||
    search.manufacturerId !== undefined ||
    search.dateFrom !== undefined ||
    search.dateTo !== undefined ||
    (search.search !== undefined && search.search.length > 0)

  const handleClearFilters = (): void => {
    setSearchDraft('')
    onSearchChange({
      ...search,
      kind: undefined,
      outcome: undefined,
      manufacturerId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      search: undefined,
      page: 1,
    })
  }

  const kindValue = search.kind ?? FILTER_ALL_SENTINEL
  const kindSegments = [
    { value: FILTER_ALL_SENTINEL, label: KIND_FILTER_LABELS.all() },
    // Design order: Sve / EMOTIVE / DOMAĆE.
    ...[...CLAIM_KIND_REGISTRY]
      .sort((a) => (a.key === 'emotive' ? -1 : 1))
      .map((definition) => ({
        value: definition.key,
        label:
          definition.key === 'domace' ? KIND_FILTER_LABELS.domace() : KIND_FILTER_LABELS.emotive(),
      })),
  ]

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-mri-border bg-mri-surface p-5 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-[7px]">
        <InternalFieldLabel>{m.claims_filter_kind()}</InternalFieldLabel>
        <div
          role="group"
          aria-label={m.claims_filter_kind()}
          className="flex overflow-hidden rounded-[9px] border border-mri-border2"
        >
          {kindSegments.map((segment, index) => (
            <button
              key={segment.value}
              type="button"
              onClick={() => {
                onSearchChange({
                  ...search,
                  kind:
                    segment.value === FILTER_ALL_SENTINEL
                      ? undefined
                      : (segment.value as ClaimsSearch['kind']),
                  page: 1,
                })
              }}
              aria-pressed={kindValue === segment.value}
              className={cn(
                'cursor-pointer px-[15px] py-[9px] text-xs font-semibold uppercase transition-colors duration-200',
                index > 0 && 'border-l border-mri-border',
                kindValue === segment.value
                  ? 'bg-mri-red text-white'
                  : 'bg-transparent text-mri-text2 hover:text-mri-text',
              )}
            >
              {segment.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-[9rem] flex-col gap-[7px]">
        <InternalFieldLabel>{m.emotive_claims_filter_outcome()}</InternalFieldLabel>
        <FilterSelect
          value={search.outcome ?? FILTER_ALL_SENTINEL}
          options={outcomeOptions}
          placeholder={m.emotive_claims_filter_outcome_all()}
          className={INTERNAL_CONTROL_CLASSES}
          aria-label={m.emotive_claims_filter_outcome()}
          onValueChange={(value) => {
            onSearchChange({
              ...search,
              outcome:
                value === FILTER_ALL_SENTINEL ? undefined : (value as ClaimsSearch['outcome']),
              page: 1,
            })
          }}
        />
      </div>

      <div className="flex min-w-[10rem] flex-1 flex-col gap-[7px] text-sm">
        <InternalFieldLabel>{m.claims_filter_manufacturer()}</InternalFieldLabel>
        <SearchableSelect
          value={search.manufacturerId ?? ''}
          options={manufacturerOptions}
          placeholder={m.claims_filter_manufacturer_all()}
          searchPlaceholder={m.field_search_placeholder()}
          emptyOptionLabel={m.claims_filter_manufacturer_all()}
          noResultsLabel={m.field_no_results()}
          className={INTERNAL_CONTROL_CLASSES}
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

      <div className="flex min-w-[10rem] flex-1 flex-col gap-[7px] text-sm">
        <InternalFieldLabel>{m.emotive_claims_filter_date_from()}</InternalFieldLabel>
        <DatePicker
          className={INTERNAL_CONTROL_CLASSES}
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

      <div className="flex min-w-[10rem] flex-1 flex-col gap-[7px] text-sm">
        <InternalFieldLabel>{m.emotive_claims_filter_date_to()}</InternalFieldLabel>
        <DatePicker
          className={INTERNAL_CONTROL_CLASSES}
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

      <label className="flex min-w-[12rem] flex-[2] flex-col gap-[7px] text-sm">
        <InternalFieldLabel>{m.emotive_claims_filter_search()}</InternalFieldLabel>
        <Input
          type="search"
          className={INTERNAL_CONTROL_CLASSES}
          placeholder={m.emotive_claims_filter_search_placeholder()}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </label>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={handleClearFilters}
          className="flex h-11 flex-none items-center gap-1.5 rounded-[9px] border border-mri-border px-3 text-[13px] font-semibold text-mri-text2 transition-colors hover:border-mri-border2 hover:text-mri-text"
        >
          <X className="size-4" aria-hidden="true" />
          {m.claims_filter_clear()}
        </button>
      ) : null}
    </div>
  )
}
