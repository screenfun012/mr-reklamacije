import {
  CLAIM_KIND_REGISTRY,
  engineManufacturersReferenceOptions,
  useDebouncedValue,
  type StatisticsSearch,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { cn, DatePicker, FilterSelect, SearchableSelect } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { INTERNAL_CONTROL_CLASSES, InternalFieldLabel } from '~/components/internal-field'
import { FILTER_ALL_SENTINEL } from '~/features/filters/filter-sentinel'
import { useLocale } from '~/lib/locale'

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

export interface StatisticsAnalyticsFiltersProps {
  search: StatisticsSearch
  onSearchChange: (next: StatisticsSearch) => void
}

export function StatisticsAnalyticsFilters({
  search,
  onSearchChange,
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

  const yearOptions = useMemo(() => buildYearOptions(), [])

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
            if (value === STATISTICS_PERIOD_ROLLING) {
              onSearchChange({
                kind: search.kind,
                manufacturerId: search.manufacturerId,
              })
              return
            }

            if (value === STATISTICS_PERIOD_CUSTOM) {
              const defaults = defaultCustomDateRange()
              onSearchChange({
                kind: search.kind,
                manufacturerId: search.manufacturerId,
                dateFrom: search.dateFrom ?? defaults.dateFrom,
                dateTo: search.dateTo ?? defaults.dateTo,
              })
              return
            }

            onSearchChange({
              kind: search.kind,
              manufacturerId: search.manufacturerId,
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
