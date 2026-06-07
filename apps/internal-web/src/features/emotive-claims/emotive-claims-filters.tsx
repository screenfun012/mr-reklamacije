import { ClaimOutcome, type EmotiveClaimsSearch } from '@mr/shared'
import { m } from '@mr/i18n'
import { Input } from '@mr/ui'
import { useEffect, useState } from 'react'

import { useDebouncedValue } from '~/lib/use-debounced-value'

const SEARCH_DEBOUNCE_MS = 300

export interface EmotiveClaimsFiltersProps {
  search: EmotiveClaimsSearch
  onSearchChange: (next: EmotiveClaimsSearch) => void
}

export function EmotiveClaimsFilters({ search, onSearchChange }: EmotiveClaimsFiltersProps) {
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
    })
  }, [debouncedSearch, onSearchChange, search])

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{m.emotive_claims_filter_outcome()}</span>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={search.outcome ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onSearchChange({
              ...search,
              outcome: value.length > 0 ? (value as EmotiveClaimsSearch['outcome']) : undefined,
            })
          }}
        >
          <option value="">{m.emotive_claims_filter_outcome_all()}</option>
          <option value={ClaimOutcome.Pending}>{m.outcome_pending()}</option>
          <option value={ClaimOutcome.Accepted}>{m.outcome_accepted()}</option>
          <option value={ClaimOutcome.Rejected}>{m.outcome_rejected()}</option>
          <option value={ClaimOutcome.Archived}>{m.outcome_archived()}</option>
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
