import {
  CLAIM_KIND_REGISTRY,
  OUTCOME_REGISTRY,
  type ClaimsSearch,
  type OutcomeLabelKey,
} from '@mr/shared'
import { m } from '@mr/i18n'
import {
  DatePicker,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mr/ui'
import { useEffect, useState } from 'react'

import { FILTER_ALL_SENTINEL } from '~/features/filters/filter-sentinel'
import { useDebouncedValue } from '~/lib/use-debounced-value'

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
  const [searchDraft, setSearchDraft] = useState(search.search ?? '')
  const debouncedSearch = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS)

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
      <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.claims_filter_kind()}</span>
        <Select
          value={search.kind ?? FILTER_ALL_SENTINEL}
          onValueChange={(value) => {
            onSearchChange({
              ...search,
              kind: value === FILTER_ALL_SENTINEL ? undefined : (value as ClaimsSearch['kind']),
              page: 1,
            })
          }}
        >
          <SelectTrigger aria-label={m.claims_filter_kind()}>
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

      <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.emotive_claims_filter_outcome()}</span>
        <Select
          value={search.outcome ?? FILTER_ALL_SENTINEL}
          onValueChange={(value) => {
            onSearchChange({
              ...search,
              outcome:
                value === FILTER_ALL_SENTINEL ? undefined : (value as ClaimsSearch['outcome']),
              page: 1,
            })
          }}
        >
          <SelectTrigger aria-label={m.emotive_claims_filter_outcome()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL_SENTINEL}>
              {m.emotive_claims_filter_outcome_all()}
            </SelectItem>
            {OUTCOME_REGISTRY.map((definition) => (
              <SelectItem key={definition.key} value={definition.key}>
                {OUTCOME_LABELS[definition.labelKey]()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
