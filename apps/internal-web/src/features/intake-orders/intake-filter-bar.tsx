import { m } from '@mr/i18n'
import {
  intakeOrderListViewValues,
  type IntakeOrderListView,
  type IntakeOrderStatus,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { Search } from 'lucide-react'
import { useEffect, useState, type ReactElement } from 'react'

import { InternalSelect } from '~/components/internal-field'
import { INTAKE_STATUS_LABELS, INTAKE_STATUS_ORDER } from './intake-status'

const SEARCH_DEBOUNCE_MS = 300

/** Keyed off the shared const, so a fourth view cannot be added without a label for it. */
const VIEW_LABELS: Record<IntakeOrderListView, () => string> = {
  active: m.intake_filter_view_active,
  unfinished: m.intake_filter_view_unfinished,
  deleted: m.intake_filter_view_deleted,
}

export interface IntakeFilterBarProps {
  status: IntakeOrderStatus | undefined
  search: string
  /** Only offered to a caller who sees the whole shop; a serviser's own drafts are always in. */
  showViewSelect: boolean
  view: IntakeOrderListView
  onStatusChange: (status: IntakeOrderStatus | undefined) => void
  onSearchChange: (search: string) => void
  onViewChange: (view: IntakeOrderListView) => void
}

export function IntakeFilterBar({
  status,
  search,
  showViewSelect,
  view,
  onStatusChange,
  onSearchChange,
  onViewChange,
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
          single bordered span with the border between them coming from the container.

          `max-w-full` + `overflow-x-auto`, not `overflow-hidden`: the five segments measure 447px,
          and on a 430px phone the group sat at right=481 with `Preuzeto` past the edge — clipped,
          with no scrollbar, so that filter could not be reached at all (measured 2026-08-08). At
          every width where the content fits, both classes are inert. */}
      <span
        className="flex max-w-full flex-none self-start overflow-x-auto rounded-[9px] border border-mri-border2"
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

      {showViewSelect ? (
        <label className="flex min-h-11 flex-none items-center gap-2 text-[12.5px] font-semibold text-mri-text2">
          {m.intake_filter_view()}
          {/* `InternalSelect`, not a bare `<select>`: the design system already dresses selects
              (tinted background, --border2 frame, red focus ring) and a raw one rendered as the
              browser's default control in the middle of the bar. `h-11` keeps the 44px touch
              target the filter row was measured at. */}
          <InternalSelect
            value={view}
            /* Narrowed through the shared const rather than asserted: `event.target.value` is
               genuinely a string, and an `as` here would be a promise the DOM never made. */
            onChange={(event) => {
              const next = intakeOrderListViewValues.find((value) => value === event.target.value)
              if (next !== undefined) {
                onViewChange(next)
              }
            }}
            className="h-11 w-auto"
          >
            {intakeOrderListViewValues.map((value) => (
              <option key={value} value={value}>
                {VIEW_LABELS[value]()}
              </option>
            ))}
          </InternalSelect>
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
        /* `whitespace-nowrap`: measured at 500px, "U RADU" broke across two lines INSIDE its own
           segment, which made that one button taller than its neighbours and left the strip
           ragged. The row is allowed to wrap; a label is not. */
        'min-h-11 cursor-pointer whitespace-nowrap border-0 px-4 py-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.06em] transition-colors',
        active ? 'bg-mri-red text-white' : 'bg-transparent text-mri-text2 hover:bg-mri-rowhv',
      )}
    >
      {children}
    </button>
  )
}
