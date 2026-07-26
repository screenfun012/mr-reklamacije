import { getLocale, m } from '@mr/i18n'
import { IntakeOrderStatus, type IntakeOrderListItem } from '@mr/shared'
import { cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import { FileWarning } from 'lucide-react'
import type { ReactElement } from 'react'

import { InternalPill } from '~/components/internal-pill'
import { INTAKE_STATUS_LABELS, INTAKE_STATUS_TONES, formatIntakeReceivedAt } from './intake-status'

/**
 * Column widths, gap and padding are the prototype's, to the pixel
 * (`126px 124px minmax(210px,1fr) 160px 74px 118px 112px`, gap 13, padding 12/18). Guessing
 * them produced a row 42px too wide, which dragged the table sideways on the serviser's tablet.
 */
const COLUMN_CLASSES =
  'grid grid-cols-[126px_124px_minmax(210px,1fr)_160px_74px_118px_112px] items-center gap-[13px] px-[18px]'

export interface IntakeOrdersTableProps {
  items: readonly IntakeOrderListItem[]
}

/**
 * One horizontal scroll container for header AND rows (`min-width: 1080px`, the prototype's own value — the handoff text quotes 1060):
 * two separate scrollers drift apart the moment a tablet is turned sideways.
 */
export function IntakeOrdersTable({ items }: IntakeOrdersTableProps): ReactElement {
  const locale = getLocale()

  if (items.length === 0) {
    return (
      <div className="min-h-[300px] rounded-[14px] border border-mri-border bg-mri-surface px-4 py-14 text-center">
        <p className="italic text-mri-text2">{m.intake_list_empty()}</p>
      </div>
    )
  }

  return (
    <div className="min-h-[300px] overflow-x-auto rounded-[14px] border border-mri-border bg-mri-surface">
      <div className="min-w-[1080px]">
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
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to="/prijem/$id"
                params={{ id: item.id }}
                className={cn(
                  COLUMN_CLASSES,
                  'py-3.5 transition-colors hover:bg-mri-rowhv',
                  item.status === IntakeOrderStatus.PickedUp && 'opacity-[.62]',
                )}
              >
                <span className="truncate font-mono text-[13px] font-semibold text-mri-text">
                  {item.orderNumber}
                </span>

                <span className="truncate font-mono text-[13px] text-mri-text">{item.plate}</span>

                {/* Vehicle and owner share one line separated by a middot, as the prototype has
                    it — stacking them made every row taller than the design for no gain. */}
                <span className="min-w-0 truncate text-[13.5px] text-mri-text">
                  {item.vehicle}
                  <span className="text-mri-text2"> · {item.ownerName}</span>
                </span>

                <span className="truncate text-[13px] text-mri-text2">{item.technicianName}</span>

                <span className="flex items-center gap-1.5 font-mono text-[13px] text-mri-text2">
                  {item.photoCount}
                  {item.photosPending > 0 ? (
                    <span title={m.intake_photos_pending_hint()} className="flex items-center">
                      <FileWarning className="size-3.5 text-mri-warn" aria-hidden="true" />
                      <span className="sr-only">
                        {m.intake_photos_pending({ count: item.photosPending })}
                      </span>
                    </span>
                  ) : null}
                </span>

                <span className="font-mono text-[12.5px] text-mri-text2">
                  {formatIntakeReceivedAt(item.receivedAt, locale)}
                </span>

                <span className="flex items-center gap-1.5">
                  {/* An unfinished intake has no meaningful status yet, so this column carries the
                      draft marker instead of a status that would be misleading. */}
                  {item.signedAt === null ? (
                    <InternalPill tone="warn" className="whitespace-nowrap">
                      {item.draftStep === null
                        ? m.intake_row_draft()
                        : m.intake_row_draft_step({ step: item.draftStep })}
                    </InternalPill>
                  ) : (
                    <InternalPill tone={INTAKE_STATUS_TONES[item.status]} dot>
                      {INTAKE_STATUS_LABELS[item.status]()}
                    </InternalPill>
                  )}
                  {item.amendedAt !== null ? (
                    <span title={m.intake_amended_hint()}>
                      <FileWarning className="size-4 text-mri-warn" aria-hidden="true" />
                      <span className="sr-only">{m.intake_amended_hint()}</span>
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
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
