import { m, getLocale } from '@mr/i18n'
import { IntakeOrderStatus, type IntakeOrderListItem } from '@mr/shared'
import { cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import { Camera, FileWarning, PencilLine } from 'lucide-react'
import type { ReactElement } from 'react'

import { InternalPill } from '~/components/internal-pill'
import { INTAKE_STATUS_LABELS, INTAKE_STATUS_TONES, formatIntakeReceivedAt } from './intake-status'

const COLUMN_CLASSES =
  'grid grid-cols-[168px_112px_minmax(180px,1fr)_124px_140px_104px_116px] items-center gap-3 px-4'

export interface IntakeOrdersTableProps {
  items: readonly IntakeOrderListItem[]
}

/**
 * One horizontal scroll container for header AND rows (`min-width: 1060px` per the handoff):
 * two separate scrollers drift apart the moment a tablet is turned sideways.
 */
export function IntakeOrdersTable({ items }: IntakeOrdersTableProps): ReactElement {
  const locale = getLocale()

  if (items.length === 0) {
    return (
      <div className="rounded-[12px] border border-mri-border bg-mri-surface px-4 py-14 text-center">
        <p className="italic text-mri-text2">{m.intake_list_empty()}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-[12px] border border-mri-border bg-mri-surface">
      <div className="min-w-[1060px]">
        <div
          className={cn(
            COLUMN_CLASSES,
            'sticky top-0 z-10 border-b border-mri-border bg-mri-surface py-2.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mri-text2',
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
                  'py-3 transition-colors hover:bg-mri-rowhv',
                  item.status === IntakeOrderStatus.PickedUp && 'opacity-[.62]',
                )}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-mono text-[13px] font-semibold text-mri-text">
                    {item.orderNumber}
                  </span>
                  {item.signedAt === null ? (
                    <InternalPill tone="warn" className="self-start whitespace-nowrap">
                      <PencilLine className="size-3" aria-hidden="true" />
                      {item.draftStep === null
                        ? m.intake_row_draft()
                        : m.intake_row_draft_step({ step: item.draftStep })}
                    </InternalPill>
                  ) : null}
                </span>

                <span className="truncate font-mono text-[13px] text-mri-text">{item.plate}</span>

                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold text-mri-text">
                    {item.vehicle}
                  </span>
                  <span className="truncate text-[12.5px] text-mri-text2">{item.ownerName}</span>
                </span>

                <span className="truncate text-[13px] text-mri-text2">{item.technicianName}</span>

                <span className="flex items-center gap-1.5 text-[13px] text-mri-text2">
                  <Camera className="size-4 flex-none" aria-hidden="true" />
                  <span className="font-mono">{item.photoCount}</span>
                  {item.photosPending > 0 ? (
                    <span title={m.intake_photos_pending_hint()}>
                      <InternalPill tone="warn" className="whitespace-nowrap">
                        {m.intake_photos_pending({ count: item.photosPending })}
                      </InternalPill>
                      <span className="sr-only">{m.intake_photos_pending_hint()}</span>
                    </span>
                  ) : null}
                </span>

                <span className="font-mono text-[12.5px] text-mri-text2">
                  {formatIntakeReceivedAt(item.receivedAt, locale)}
                </span>

                <span className="flex items-center gap-1.5">
                  <InternalPill tone={INTAKE_STATUS_TONES[item.status]} dot>
                    {INTAKE_STATUS_LABELS[item.status]()}
                  </InternalPill>
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
      className="min-h-[300px] animate-pulse rounded-[12px] border border-mri-border bg-mri-surface"
    />
  )
}
