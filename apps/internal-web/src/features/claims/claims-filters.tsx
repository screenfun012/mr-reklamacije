import {
  CLAIM_KIND_REGISTRY,
  OUTCOME_REGISTRY,
  type ClaimsSearch,
  type OutcomeLabelKey,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Input } from '@mr/ui'
import { useEffect, useState } from 'react'

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
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.claims_filter_kind()}</span>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={search.kind ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onSearchChange({
              ...search,
              kind: value.length > 0 ? (value as ClaimsSearch['kind']) : undefined,
              page: 1,
            })
          }}
        >
          <option value="">{KIND_FILTER_LABELS.all()}</option>
          {CLAIM_KIND_REGISTRY.map((definition) => (
            <option key={definition.key} value={definition.key}>
              {definition.key === 'domace'
                ? KIND_FILTER_LABELS.domace()
                : KIND_FILTER_LABELS.emotive()}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.emotive_claims_filter_outcome()}</span>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={search.outcome ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onSearchChange({
              ...search,
              outcome: value.length > 0 ? (value as ClaimsSearch['outcome']) : undefined,
              page: 1,
            })
          }}
        >
          <option value="">{m.emotive_claims_filter_outcome_all()}</option>
          {OUTCOME_REGISTRY.map((definition) => (
            <option key={definition.key} value={definition.key}>
              {OUTCOME_LABELS[definition.labelKey]()}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.emotive_claims_filter_date_from()}</span>
        <Input
          type="date"
          value={search.dateFrom ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onSearchChange({
              ...search,
              dateFrom: value.length > 0 ? value : undefined,
              page: 1,
            })
          }}
        />
      </label>

      <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.emotive_claims_filter_date_to()}</span>
        <Input
          type="date"
          value={search.dateTo ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onSearchChange({
              ...search,
              dateTo: value.length > 0 ? value : undefined,
              page: 1,
            })
          }}
        />
      </label>

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
