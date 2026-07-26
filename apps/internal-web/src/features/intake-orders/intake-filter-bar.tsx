import { m } from '@mr/i18n'
import type { IntakeOrderStatus } from '@mr/shared'
import { cn } from '@mr/ui'
import { Search } from 'lucide-react'
import { useEffect, useState, type ReactElement } from 'react'

import { INTAKE_STATUS_LABELS, INTAKE_STATUS_ORDER } from './intake-status'

const SEARCH_DEBOUNCE_MS = 300

export interface IntakeFilterBarProps {
  status: IntakeOrderStatus | undefined
  search: string
  /** Only offered to a caller who sees the whole shop; a serviser's own drafts are always in. */
  showUnfinishedToggle: boolean
  unfinished: boolean
  onStatusChange: (status: IntakeOrderStatus | undefined) => void
  onSearchChange: (search: string) => void
  onUnfinishedChange: (unfinished: boolean) => void
}

export function IntakeFilterBar({
  status,
  search,
  showUnfinishedToggle,
  unfinished,
  onStatusChange,
  onSearchChange,
  onUnfinishedChange,
}: IntakeFilterBarProps): ReactElement {
  const [draft, setDraft] = useState(search)

  // Keep the box in step when the URL changes from outside (back button, a KPI card).
  useEffect(() => {
    setDraft(search)
  }, [search])

  // 300 ms quiet window, the house debounce — the shop's WiFi should not carry a request
  // per keystroke.
  useEffect(() => {
    if (draft === search) {
      return
    }
    const timer = setTimeout(() => {
      onSearchChange(draft)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [draft, search, onSearchChange])

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-mri-border bg-mri-surface p-3.5 lg:flex-row lg:items-center">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={m.intake_filter_status()}>
        <FilterSegment active={status === undefined} onClick={() => onStatusChange(undefined)}>
          {m.intake_filter_all()}
        </FilterSegment>
        {INTAKE_STATUS_ORDER.map((value) => (
          <FilterSegment
            key={value}
            active={status === value}
            onClick={() => onStatusChange(value)}
          >
            {INTAKE_STATUS_LABELS[value]()}
          </FilterSegment>
        ))}
      </div>

      <div className="relative lg:ml-auto lg:w-[320px]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mri-text2"
        />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={m.intake_search_placeholder()}
          aria-label={m.intake_search_placeholder()}
          className="h-11 w-full rounded-[9px] border border-mri-border bg-mri-inbg pl-9 pr-3 text-base text-mri-text placeholder:text-mri-text2 focus:border-mri-red focus:outline-none"
        />
      </div>

      {showUnfinishedToggle ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-mri-text2">
          <input
            type="checkbox"
            checked={unfinished}
            onChange={(event) => onUnfinishedChange(event.target.checked)}
            className="size-4 accent-mri-red"
          />
          {m.intake_filter_unfinished()}
        </label>
      ) : null}
    </div>
  )
}

function FilterSegment({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactElement | string
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-11 cursor-pointer rounded-[9px] border px-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors',
        active
          ? 'border-mri-red bg-mri-red text-white'
          : 'border-mri-border text-mri-text2 hover:bg-mri-rowhv hover:text-mri-text',
      )}
    >
      {children}
    </button>
  )
}
