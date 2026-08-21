import {
  CLAIM_KIND_REGISTRY,
  claimCategoryCountsOptions,
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
import { hasActiveClaimsFilters, type ClaimsListMode } from './claims-list-mode'
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
  mode: ClaimsListMode
  /** Leave the category's own list, keeping every other filter. */
  onLeaveCategory: (next: ClaimsSearch) => void
}

export function ClaimsFilters({
  search,
  onSearchChange,
  mode,
  onLeaveCategory,
}: ClaimsFiltersProps) {
  const { locale } = useLocale()
  const [searchDraft, setSearchDraft] = useState(search.search ?? '')
  const debouncedSearch = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS)
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
  // One source for what a category is called and whether it is still live — the same answer the
  // sidebar and the list header read, so a rename cannot show up in one place and not the other.
  const { data: counts } = useSuspenseQuery(claimCategoryCountsOptions())

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

  const categoryOptions = useMemo(
    () =>
      counts.items.map((category) => ({
        value: category.code,
        label: category.isActive ? category.name : `${category.name} †`,
        keywords: category.code,
        // Retired categories still carrying claims are listed apart rather than mixed in — the
        // office switched them off, and the filter should not pretend otherwise.
        ...(category.isActive ? {} : { group: m.claims_filter_category_retired_group() }),
      })),
    [counts, locale],
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

  // In category mode the code lives in the path, so it is not in `search` at all and cannot be
  // cleared by accident — "Poništi filtere" never moves you out of the category you are in.
  const hasActiveFilters = hasActiveClaimsFilters(search)

  const handleClearFilters = (): void => {
    setSearchDraft('')
    onSearchChange({
      ...search,
      kind: undefined,
      outcome: undefined,
      manufacturerId: undefined,
      categoryCode: undefined,
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
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-mri-border bg-mri-surface p-[14px] sm:flex-row sm:flex-wrap sm:items-end">
      {/* Search leads the row (prototype §4): it is the filter people reach for first. */}
      <label className="flex min-w-[220px] flex-1 flex-col gap-[7px] text-sm">
        <InternalFieldLabel>{m.emotive_claims_filter_search()}</InternalFieldLabel>
        <Input
          type="search"
          className={INTERNAL_CONTROL_CLASSES}
          placeholder={m.emotive_claims_filter_search_placeholder()}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </label>

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

      {mode.kind === 'category' ? (
        <div className="flex flex-col justify-end gap-[7px] text-sm">
          <span
            className="flex h-11 items-center gap-2 rounded-[9px] border border-dashed border-[rgba(237,28,36,.45)] bg-[rgba(237,28,36,.09)] px-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mri-text2"
            data-testid="claims-category-chip"
          >
            {m.claims_filter_category_chip_prefix()}{' '}
            <span className="text-mri-text">{mode.category?.name ?? mode.code}</span>
            <button
              type="button"
              aria-label={m.claims_filter_category_chip_leave()}
              title={m.claims_filter_category_chip_leave()}
              className="cursor-pointer text-xs text-mri-redh"
              onClick={() => onLeaveCategory({ ...search, page: 1 })}
            >
              ✕
            </button>
          </span>
        </div>
      ) : (
        <div className="flex min-w-[10rem] flex-1 flex-col gap-[7px] text-sm">
          <InternalFieldLabel>{m.claims_filter_category()}</InternalFieldLabel>
          <SearchableSelect
            value={search.categoryCode ?? ''}
            options={categoryOptions}
            placeholder={m.claims_filter_category_all()}
            searchPlaceholder={m.field_search_placeholder()}
            emptyOptionLabel={m.claims_filter_category_all()}
            noResultsLabel={m.field_no_results()}
            className={INTERNAL_CONTROL_CLASSES}
            aria-label={m.claims_filter_category()}
            onValueChange={(categoryCode) => {
              // The CODE travels, not the id (spec §4.2): it lands in the URL and reads plainly
              // in a bookmark. Here it is an ordinary filter — the PLACE is the route.
              onSearchChange({
                ...search,
                categoryCode: categoryCode.length > 0 ? categoryCode : undefined,
                page: 1,
              })
            }}
          />
        </div>
      )}

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
