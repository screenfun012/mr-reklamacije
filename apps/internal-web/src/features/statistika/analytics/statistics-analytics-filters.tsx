import {
  CLAIM_KIND_REGISTRY,
  claimCategoriesReferenceOptions,
  engineManufacturersReferenceOptions,
  useDebouncedValue,
  type StatisticsCategoryFieldGroup,
  type StatisticsSearch,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { cn, DatePicker, FilterSelect, SearchableSelect } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { INTERNAL_CONTROL_CLASSES, InternalFieldLabel } from '~/components/internal-field'
import { FILTER_ALL_SENTINEL } from '~/features/filters/filter-sentinel'
import { useLocale } from '@mr/ui'

const DATE_DEBOUNCE_MS = 300
const STATISTICS_PERIOD_ROLLING = '__rolling24__'
const STATISTICS_PERIOD_CUSTOM = '__custom__'
const YEAR_LOOKBACK = 15

const KIND_FILTER_LABELS = {
  all: () => m.statistika_analytics_filter_kind_all(),
  domace: () => m.claims_filter_kind_domace(),
  emotive: () => m.claims_filter_kind_emotive(),
} as const

function buildYearOptions(): number[] {
  const currentYear = new Date().getUTCFullYear()
  return Array.from({ length: YEAR_LOOKBACK + 1 }, (_, index) => currentYear - index)
}

function resolvePeriodValue(search: StatisticsSearch): string {
  if (search.dateFrom !== undefined && search.dateTo !== undefined) {
    return STATISTICS_PERIOD_CUSTOM
  }

  if (search.year !== undefined) {
    return String(search.year)
  }

  return STATISTICS_PERIOD_ROLLING
}

function defaultCustomDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
  }
}

/**
 * The chip has to NAME the answer holding the screen down, and only the summary knows the names —
 * the URL carries codes. Codes are the fallback: an empty period leaves the section with nothing to
 * read the names from, and a chip that cannot name the answer must still say which one is set.
 */
function resolveAnswerFilterLabel(
  groups: readonly StatisticsCategoryFieldGroup[],
  search: StatisticsSearch,
): string | null {
  const { categoryCode, fieldCode, optionCode } = search

  if (categoryCode === undefined || fieldCode === undefined || optionCode === undefined) {
    return null
  }

  const field = groups
    .find((group) => group.categoryCode === categoryCode)
    ?.fields.find((candidate) => candidate.fieldCode === fieldCode)
  const bucket = field?.items.find((item) => item.code === optionCode)

  return `${field?.fieldName ?? fieldCode} › ${bucket?.name ?? optionCode}`
}

export interface StatisticsAnalyticsFiltersProps {
  search: StatisticsSearch
  onSearchChange: (next: StatisticsSearch) => void
  /** Only to name the chip — the filter itself travels by code in the URL. */
  byCategoryFields: StatisticsCategoryFieldGroup[]
}

export function StatisticsAnalyticsFilters({
  search,
  onSearchChange,
  byCategoryFields,
}: StatisticsAnalyticsFiltersProps): React.ReactElement {
  const { locale } = useLocale()
  const periodValue = resolvePeriodValue(search)
  const showCustomRange = periodValue === STATISTICS_PERIOD_CUSTOM
  const [dateFromDraft, setDateFromDraft] = useState(search.dateFrom)
  const [dateToDraft, setDateToDraft] = useState(search.dateTo)
  const debouncedDateFrom = useDebouncedValue(dateFromDraft, DATE_DEBOUNCE_MS)
  const debouncedDateTo = useDebouncedValue(dateToDraft, DATE_DEBOUNCE_MS)
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
  )
  const { data: categories } = useSuspenseQuery(
    claimCategoriesReferenceOptions({ activeOnly: true }),
  )

  const yearOptions = useMemo(() => buildYearOptions(), [])
  const answerFilterLabel = resolveAnswerFilterLabel(byCategoryFields, search)

  const periodOptions = useMemo(
    () => [
      {
        value: STATISTICS_PERIOD_ROLLING,
        label: m.statistika_analytics_filter_period_rolling(),
      },
      ...yearOptions.map((year) => ({
        value: String(year),
        label: String(year),
      })),
      {
        value: STATISTICS_PERIOD_CUSTOM,
        label: m.statistika_analytics_filter_period_custom(),
      },
    ],
    [yearOptions, locale],
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
      categories.map((category) => ({
        // The CODE is the value here, not the id — the same one the claims list carries.
        value: category.code,
        label: category.name,
        keywords: category.code,
      })),
    [categories],
  )

  useEffect(() => {
    setDateFromDraft(search.dateFrom)
    setDateToDraft(search.dateTo)
  }, [search.dateFrom, search.dateTo])

  useEffect(() => {
    if (!showCustomRange) {
      return
    }

    if (debouncedDateFrom === search.dateFrom && debouncedDateTo === search.dateTo) {
      return
    }

    if (debouncedDateFrom === undefined || debouncedDateTo === undefined) {
      return
    }

    onSearchChange({
      ...search,
      year: undefined,
      dateFrom: debouncedDateFrom,
      dateTo: debouncedDateTo,
    })
  }, [debouncedDateFrom, debouncedDateTo, onSearchChange, search, showCustomRange])

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
    <div className="mri-fade-up flex flex-col gap-4 rounded-[14px] border border-mri-border bg-mri-surface p-5 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-[12rem] flex-col gap-[7px]">
        <InternalFieldLabel>{m.statistika_analytics_filter_period()}</InternalFieldLabel>
        <FilterSelect
          value={periodValue}
          options={periodOptions}
          placeholder={m.statistika_analytics_filter_period_rolling()}
          aria-label={m.statistika_analytics_filter_period()}
          className={INTERNAL_CONTROL_CLASSES}
          onValueChange={(value) => {
            // Rebuilt from scratch on purpose (the period keys are mutually exclusive), so every
            // other filter has to be carried over by hand or it drops when the period changes.
            const kept = {
              kind: search.kind,
              manufacturerId: search.manufacturerId,
              categoryCode: search.categoryCode,
              // Without these two the answer filter would silently vanish on every period change.
              fieldCode: search.fieldCode,
              optionCode: search.optionCode,
            }

            if (value === STATISTICS_PERIOD_ROLLING) {
              onSearchChange(kept)
              return
            }

            if (value === STATISTICS_PERIOD_CUSTOM) {
              const defaults = defaultCustomDateRange()
              onSearchChange({
                ...kept,
                dateFrom: search.dateFrom ?? defaults.dateFrom,
                dateTo: search.dateTo ?? defaults.dateTo,
              })
              return
            }

            onSearchChange({
              ...kept,
              year: Number.parseInt(value, 10),
            })
          }}
        />
      </div>

      {showCustomRange ? (
        <>
          <div className="flex min-w-[10rem] flex-1 flex-col gap-[7px] text-sm">
            <InternalFieldLabel>{m.statistika_analytics_filter_date_from()}</InternalFieldLabel>
            <DatePicker
              className={INTERNAL_CONTROL_CLASSES}
              value={dateFromDraft}
              onChange={setDateFromDraft}
              aria-label={m.statistika_analytics_filter_date_from()}
            />
          </div>
          <div className="flex min-w-[10rem] flex-1 flex-col gap-[7px] text-sm">
            <InternalFieldLabel>{m.statistika_analytics_filter_date_to()}</InternalFieldLabel>
            <DatePicker
              className={INTERNAL_CONTROL_CLASSES}
              value={dateToDraft}
              onChange={setDateToDraft}
              aria-label={m.statistika_analytics_filter_date_to()}
            />
          </div>
        </>
      ) : null}

      <div className="flex min-w-[10rem] flex-1 flex-col gap-[7px] text-sm">
        <InternalFieldLabel>{m.statistika_analytics_filter_manufacturer()}</InternalFieldLabel>
        <SearchableSelect
          className={INTERNAL_CONTROL_CLASSES}
          value={search.manufacturerId ?? ''}
          options={manufacturerOptions}
          placeholder={m.statistika_analytics_filter_manufacturer_all()}
          searchPlaceholder={m.field_search_placeholder()}
          emptyOptionLabel={m.statistika_analytics_filter_manufacturer_all()}
          noResultsLabel={m.field_no_results()}
          aria-label={m.statistika_analytics_filter_manufacturer()}
          onValueChange={(manufacturerId) => {
            onSearchChange({
              ...search,
              manufacturerId: manufacturerId.length > 0 ? manufacturerId : undefined,
            })
          }}
        />
      </div>

      <div className="flex min-w-[10rem] flex-1 flex-col gap-[7px] text-sm">
        <InternalFieldLabel>{m.statistika_analytics_filter_category()}</InternalFieldLabel>
        <SearchableSelect
          className={INTERNAL_CONTROL_CLASSES}
          value={search.categoryCode ?? ''}
          options={categoryOptions}
          placeholder={m.statistika_analytics_filter_category_all()}
          searchPlaceholder={m.field_search_placeholder()}
          emptyOptionLabel={m.statistika_analytics_filter_category_all()}
          noResultsLabel={m.field_no_results()}
          aria-label={m.statistika_analytics_filter_category()}
          onValueChange={(categoryCode) => {
            onSearchChange({
              ...search,
              categoryCode: categoryCode.length > 0 ? categoryCode : undefined,
              // A field code is unique per category, not across the shop: kept across a category
              // change it would name a question the new category never asks.
              fieldCode: undefined,
              optionCode: undefined,
            })
          }}
        />
      </div>

      <div className="flex flex-col gap-[7px]">
        <InternalFieldLabel>{m.statistika_analytics_filter_kind()}</InternalFieldLabel>
        <div
          role="group"
          aria-label={m.statistika_analytics_filter_kind()}
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
                      : (segment.value as StatisticsSearch['kind']),
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

      {answerFilterLabel === null ? null : (
        <div className="flex flex-col justify-end gap-[7px] text-sm">
          <span
            className="flex h-11 items-center gap-2 rounded-[9px] border border-dashed border-[rgba(14,147,132,.45)] bg-[rgba(14,147,132,.09)] px-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mri-text"
            data-testid="statistics-answer-chip"
          >
            {answerFilterLabel}
            <button
              type="button"
              aria-label={m.statistika_answer_filter_clear()}
              title={m.statistika_answer_filter_clear()}
              className="cursor-pointer text-xs text-mri-redh"
              onClick={() => {
                onSearchChange({
                  ...search,
                  categoryCode: undefined,
                  fieldCode: undefined,
                  optionCode: undefined,
                })
              }}
            >
              ✕
            </button>
          </span>
        </div>
      )}

      <InternalButton
        type="button"
        variant="outline"
        className="h-10 w-auto self-start px-4 text-xs sm:self-end"
        onClick={() => {
          onSearchChange({})
        }}
      >
        ✕ {m.statistika_analytics_filter_clear()}
      </InternalButton>
    </div>
  )
}
