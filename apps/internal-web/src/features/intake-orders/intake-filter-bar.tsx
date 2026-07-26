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
    <div className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface px-[17px] py-[15px] lg:flex-row lg:items-center">
      {/* One joined segmented control, not separate pills — the prototype wraps the buttons in a
          single bordered span with the border between them coming from the container. */}
      <span
        className="flex flex-none self-start overflow-hidden rounded-[9px] border border-mri-border2"
        role="group"
        aria-label={m.intake_filter_status()}
      >
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
      </span>

      <span className="flex h-11 flex-1 items-center gap-2.5 rounded-[9px] border border-mri-border2 bg-mri-inbg px-3.5">
        <Search aria-hidden="true" className="size-4 flex-none text-mri-text2" />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={m.intake_search_placeholder()}
          aria-label={m.intake_search_placeholder()}
          className="min-w-0 flex-1 border-0 bg-transparent text-base text-mri-text outline-none placeholder:text-mri-text2"
        />
      </span>

      {showUnfinishedToggle ? (
        <label className="flex min-h-11 flex-none cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-mri-text2">
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
        'min-h-11 cursor-pointer border-0 px-4 py-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.06em] transition-colors',
        active ? 'bg-mri-red text-white' : 'bg-transparent text-mri-text2 hover:bg-mri-rowhv',
      )}
    >
      {children}
    </button>
  )
}
