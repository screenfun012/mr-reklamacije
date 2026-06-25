import {
  CLAIM_KIND_REGISTRY,
  engineManufacturersReferenceOptions,
  type StatisticsSearch,
} from '@mr/shared'
import { m } from '@mr/i18n'
import {
  Button,
  DatePicker,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { FILTER_ALL_SENTINEL } from '~/features/filters/filter-sentinel'
import { useDebouncedValue } from '@mr/shared'

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
  const periodValue = resolvePeriodValue(search)
  const showCustomRange = periodValue === STATISTICS_PERIOD_CUSTOM
  const [dateFromDraft, setDateFromDraft] = useState(search.dateFrom)
  const [dateToDraft, setDateToDraft] = useState(search.dateTo)
  const debouncedDateFrom = useDebouncedValue(dateFromDraft, DATE_DEBOUNCE_MS)
  const debouncedDateTo = useDebouncedValue(dateToDraft, DATE_DEBOUNCE_MS)
  const { data: manufacturers } = useSuspenseQuery(
    engineManufacturersReferenceOptions({ activeOnly: true }),
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

  const yearOptions = useMemo(() => buildYearOptions(), [])

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

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">
          {m.statistika_analytics_filter_period()}
        </span>
        <Select
          value={periodValue}
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
        >
          <SelectTrigger aria-label={m.statistika_analytics_filter_period()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATISTICS_PERIOD_ROLLING}>
              {m.statistika_analytics_filter_period_rolling()}
            </SelectItem>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
            <SelectItem value={STATISTICS_PERIOD_CUSTOM}>
              {m.statistika_analytics_filter_period_custom()}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showCustomRange ? (
        <>
          <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">
              {m.statistika_analytics_filter_date_from()}
            </span>
            <DatePicker
              value={dateFromDraft}
              onChange={setDateFromDraft}
              aria-label={m.statistika_analytics_filter_date_from()}
            />
          </div>
          <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">
              {m.statistika_analytics_filter_date_to()}
            </span>
            <DatePicker
              value={dateToDraft}
              onChange={setDateToDraft}
              aria-label={m.statistika_analytics_filter_date_to()}
            />
          </div>
        </>
      ) : null}

      <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">
          {m.statistika_analytics_filter_manufacturer()}
        </span>
        <SearchableSelect
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

      <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.statistika_analytics_filter_kind()}</span>
        <Select
          value={search.kind ?? FILTER_ALL_SENTINEL}
          onValueChange={(value) => {
            onSearchChange({
              ...search,
              kind: value === FILTER_ALL_SENTINEL ? undefined : (value as StatisticsSearch['kind']),
            })
          }}
        >
          <SelectTrigger aria-label={m.statistika_analytics_filter_kind()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL_SENTINEL}>{KIND_FILTER_LABELS.all()}</SelectItem>
            {CLAIM_KIND_REGISTRY.map((definition) => (
              <SelectItem key={definition.key} value={definition.key}>
                {definition.key === 'domace'
                  ? KIND_FILTER_LABELS.domace()
                  : KIND_FILTER_LABELS.emotive()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="outline"
        className="self-start sm:self-end"
        onClick={() => {
          onSearchChange({})
        }}
      >
        {m.statistika_analytics_filter_clear()}
      </Button>
    </div>
  )
}
