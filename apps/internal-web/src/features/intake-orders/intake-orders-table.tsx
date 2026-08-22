import { getLocale, m } from '@mr/i18n'
import { IntakeOrderStatus, type IntakeOrderListItem } from '@mr/shared'
import { cn, dataTableIconActionClassName } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import { FileWarning } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { InternalPill } from '~/components/internal-pill'
import { INTAKE_STATUS_LABELS, INTAKE_STATUS_TONES, formatIntakeReceivedAt } from './intake-status'
import { displayDraftStep, INTAKE_WIZARD_STEP_COUNT } from './wizard/intake-wizard-state'

/**
 * Column widths, gap and padding are the prototype's, to the pixel
 * (`126px 124px minmax(210px,1fr) 160px 74px 118px 112px`, gap 13, padding 12/18). Guessing
 * them produced a row 42px too wide, which dragged the table sideways on the serviser's tablet.
 *
 * The display is NOT in here: under a narrow container the same values render as a card
 * instead, so each consumer says `hidden @min-[1078px]:grid` itself rather than relying on
 * class order to undo a `grid`.
 */
const COLUMN_CLASSES =
  'hidden @min-[1078px]:grid grid-cols-[126px_124px_minmax(210px,1fr)_160px_74px_118px_112px] items-center gap-[13px] px-[18px]'

/**
 * What the row's one action is, decided by the page — a draft is discarded, a signed order is
 * archived or brought back, and which of those a reader may do is a permission question the list
 * screen owns. The table only draws what it is handed, and `null` draws an empty slot.
 */
export interface IntakeRowAction {
  icon: LucideIcon
  label: string
  onSelect: () => void
}

export interface IntakeOrdersTableProps {
  items: readonly IntakeOrderListItem[]
  rowAction: (item: IntakeOrderListItem) => IntakeRowAction | null
}

/**
 * Wide enough: one horizontal scroll container for header AND rows — two separate scrollers
 * drift apart the moment a tablet is turned sideways.
 *
 * "Wide enough" is **1078px, the sum of the row's own parts**: columns 126+124+210+160+74+118+112
 * = 924, six 13px gaps = 78, two 18px paddings = 36 — and since 2026-08-22 a 40px action slot
 * beside the link, which is why the number went from 1038 to 1078. It is a sum, never a figure
 * taken on faith: the container once demanded `1080px` (the prototype's stated scroll width) and
 * those 42px of slack are the same 42 the comment above records as having dragged the table
 * sideways before. Change a column, a gap or the slot, and change this in the four places that
 * carry it — the test parses them out precisely so they cannot drift apart.
 *
 * Otherwise: a card per order. The row does not fit a phone (430) or a tablet held
 * upright (820), and a sideways-scrolling table on either is present rather than usable. The
 * two layouts render the SAME values — the status pill and the two markers are built once per
 * item and placed in both — so only the arrangement differs, never the data. The switch is CSS,
 * not a width hook: a hook would disagree between the server render and the browser's.
 *
 * The query is on the CONTAINER, not the viewport, because the viewport does not know how much
 * room this table actually has. The same 1366px desktop gives it 1066px with the sidebar open
 * (a horizontal scrollbar), ~1230px with the sidebar collapsed to its icon rail, and more again
 * for a serviser, who has no sidebar at all. A viewport breakpoint gets two of those three
 * wrong. `@min-[1078px]` resolves against this box's content width, which is exactly the space
 * the row needs — so the row appears precisely when it fits, whatever the sidebar is doing.
 */
export function IntakeOrdersTable({ items, rowAction }: IntakeOrdersTableProps): ReactElement {
  const locale = getLocale()

  if (items.length === 0) {
    return (
      <div className="min-h-[300px] rounded-[14px] border border-mri-border bg-mri-surface px-4 py-14 text-center">
        <p className="italic text-mri-text2">{m.intake_list_empty()}</p>
      </div>
    )
  }

  return (
    <div className="@container min-h-[300px] rounded-[14px] border border-mri-border bg-mri-surface @min-[1078px]:overflow-x-auto">
      {/* overflow-x stays as insurance against sub-pixel rounding at the exact switch point;
          by construction the row only renders once the container can hold all 1078px of it. */}
      <div className="@min-[1078px]:min-w-[1078px]">
        <div
          className={cn(
            COLUMN_CLASSES,
            'sticky top-0 z-10 border-b border-mri-border bg-mri-surface py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2',
          )}
        >
          <span>{m.intake_col_order()}</span>
          <span>{m.intake_col_plate()}</span>
          <span>{m.intake_col_vehicle_owner()}</span>
          <span>{m.intake_col_technician()}</span>
          <span>{m.intake_col_photos()}</span>
          <span>{m.intake_col_received()}</span>
          <span>{m.intake_col_status()}</span>
        </div>

        <ul className="divide-y divide-mri-border">
          {items.map((item) => {
            /* Built once, placed in both layouts. React elements are descriptions, so the same
               one renders in the row and in the card; only one of the two is ever displayed. */
            const statusCell =
              /* An unfinished intake has no meaningful status yet, so it carries the draft
                 marker instead of a status that would be misleading. */
              item.signedAt === null ? (
                <InternalPill tone="warn" className="whitespace-nowrap">
                  {item.draftStep === null
                    ? m.intake_row_draft()
                    : m.intake_row_draft_step({
                        step: displayDraftStep(item.draftStep),
                        total: INTAKE_WIZARD_STEP_COUNT,
                      })}
                </InternalPill>
              ) : (
                <InternalPill tone={INTAKE_STATUS_TONES[item.status]} dot>
                  {INTAKE_STATUS_LABELS[item.status]()}
                </InternalPill>
              )

            const pendingMarker =
              item.photosPending > 0 ? (
                <span title={m.intake_photos_pending_hint()} className="flex items-center">
                  <FileWarning className="size-3.5 text-mri-warn" aria-hidden="true" />
                  <span className="sr-only">
                    {m.intake_photos_pending({ count: item.photosPending })}
                  </span>
                </span>
              ) : null

            const received = formatIntakeReceivedAt(item.receivedAt, locale)
            const action = rowAction(item)

            return (
              // The action sits BESIDE the link, never inside it: a button inside an anchor is
              // invalid, and a tap on it would follow the row as well. The 40px slot is rendered
              // for every row, empty or not, so the columns line up down the whole list.
              <li key={item.id} className="flex items-stretch">
                <Link
                  to="/prijem/$id"
                  params={{ id: item.id }}
                  className={cn(
                    'block min-w-0 flex-1 transition-colors hover:bg-mri-rowhv',
                    item.status === IntakeOrderStatus.PickedUp && 'opacity-[.62]',
                  )}
                >
                  <div className={cn(COLUMN_CLASSES, 'py-3.5')}>
                    <span className="truncate font-mono text-[13px] font-semibold text-mri-text">
                      {item.orderNumber}
                    </span>

                    <span className="truncate font-mono text-[13px] text-mri-text">
                      {item.plate}
                    </span>

                    {/* Vehicle and owner share one line separated by a middot, as the prototype
                        has it — stacking them made every row taller than the design for no gain. */}
                    <span className="min-w-0 truncate text-[13.5px] text-mri-text">
                      {item.vehicle}
                      <span className="text-mri-text2"> · {item.ownerName}</span>
                    </span>

                    <span className="truncate text-[13px] text-mri-text2">
                      {item.technicianName}
                    </span>

                    <span className="flex items-center gap-1.5 font-mono text-[13px] text-mri-text2">
                      {item.photoCount}
                      {pendingMarker}
                    </span>

                    <span className="font-mono text-[12.5px] text-mri-text2">{received}</span>

                    <span className="flex items-center gap-1.5">{statusCell}</span>
                  </div>

                  {/* Narrow: the order number and its status on top, then what the car is, then
                      who took it in and when. Nothing scrolls sideways. */}
                  <div className="flex flex-col gap-1.5 px-4 py-3 @min-[1078px]:hidden">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-[13.5px] font-semibold text-mri-text">
                        {item.orderNumber}
                      </span>
                      {statusCell}
                    </div>

                    <div className="truncate text-[13.5px] text-mri-text">
                      <span className="font-mono">{item.plate}</span>
                      <span className="text-mri-text2">
                        {' · '}
                        {item.vehicle}
                        {' · '}
                        {item.ownerName}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-mri-text2">
                      <span className="truncate">{item.technicianName}</span>
                      <span className="font-mono">{received}</span>
                      <span className="flex items-center gap-1.5 font-mono">
                        {m.intake_col_photos()} {item.photoCount}
                        {pendingMarker}
                      </span>
                    </div>
                  </div>
                </Link>

                <span className="flex w-10 flex-none items-center justify-center">
                  {action === null ? null : (
                    <button
                      type="button"
                      className={cn(dataTableIconActionClassName, 'hover:text-mri-bad')}
                      aria-label={action.label}
                      title={action.label}
                      onClick={action.onSelect}
                    >
                      <action.icon className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export function IntakeOrdersTableSkeleton(): ReactElement {
  return (
    <div
      aria-label={m.common_loading()}
      className="min-h-[300px] animate-pulse rounded-[14px] border border-mri-border bg-mri-surface"
    />
  )
}
