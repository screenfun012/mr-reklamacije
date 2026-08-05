import { m } from '@mr/i18n'
import {
  advanceIntakeOrder,
  deleteIntakeOrder,
  intakeOrderKeys,
  IntakeOrderStatus,
  type IntakeOrderDetail,
} from '@mr/shared'
import { cn, ConfirmDialog } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type ReactElement } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalPill } from '~/components/internal-pill'
import { showInternalToast } from '~/lib/internal-toast'

import { INTAKE_VEHICLE_TYPE_LABELS } from '../intake-labels'
import { INTAKE_STATUS_LABELS, INTAKE_STATUS_TONES, nextIntakeStatus } from '../intake-status'

const ACTION_CLASSES = 'h-[46px] w-auto px-[18px] text-[13px]'
const PRINT_REASON_ID = 'intake-detail-print-reason'

export interface IntakeDetailHeaderProps {
  order: IntakeOrderDetail
  canAdvance: boolean
  canDelete: boolean
  /**
   * Not used to render anything — it decides whether the last status step needs confirming.
   * Whoever may change the status has the strip right below this header and moves it back in one
   * tap; whoever may only advance has no way back at all once the order is picked up.
   */
  canChangeStatus: boolean
}

const STATUS_PILL_CLASSES = 'px-[11px] py-[5px] text-[10.5px] tracking-[0.08em]'

/**
 * The prototype tints this button by the status it moves INTO, not by a single house colour
 * (`prijem-prototip-v2.dc.html:439`, resolved at `:1412-1416`) — so the serviser reads where the
 * tap will land before he reads the words. Values are its own, transferred rather than judged.
 * `primary` was wrong here twice over: it is the neutral near-white fill with a 30 px shadow and a
 * hover lift, which made a routine status nudge the loudest thing on a screen whose real subject is
 * the car, and it looked identical for all three destinations.
 */
const ADVANCE_CLASSES: Record<IntakeOrderStatus, string> = {
  [IntakeOrderStatus.Received]: '',
  [IntakeOrderStatus.InProgress]:
    'border border-[rgba(245,165,36,0.45)] bg-[rgba(245,165,36,0.14)] text-mri-warn hover:bg-[rgba(245,165,36,0.22)]',
  [IntakeOrderStatus.Done]:
    'border border-[rgba(31,169,113,0.45)] bg-[rgba(31,169,113,0.16)] text-mri-ok hover:bg-[rgba(31,169,113,0.24)]',
  [IntakeOrderStatus.PickedUp]:
    'border border-mri-border2 bg-[rgba(107,108,114,0.16)] text-mri-text hover:bg-[rgba(107,108,114,0.24)]',
}

export function IntakeDetailHeader({
  order,
  canAdvance,
  canDelete,
  canChangeStatus,
}: IntakeDetailHeaderProps): ReactElement {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmPickup, setConfirmPickup] = useState(false)

  // Every intake mutation touches the detail, the list, the KPI row AND the history tab, and
  // all four keys hang off one root — invalidating the root cannot forget one of them.
  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })

  const next = nextIntakeStatus(order.status)
  const isLive = order.deletedAt === null && order.signedAt !== null

  /*
   * "Preuzeto" is the one step this actor cannot walk back: it is the last status, so the button
   * disappears with it, and it asserts a physical fact — the owner drove the vehicle away. Whoever
   * holds `change_status` is not in that position (the strip below moves it back in one tap), and
   * making him confirm three times a day is how a dialog stops being read at all.
   */
  const needsPickupConfirm = next === IntakeOrderStatus.PickedUp && !canChangeStatus

  const advance = useMutation({
    mutationFn: () => advanceIntakeOrder(order.id),
    onSuccess: async (updated) => {
      // ConfirmDialog never closes itself — the caller owns `open`. Left standing, its confirm
      // button re-fires an advance the server now answers 409, so a move that worked reports a
      // failure.
      setConfirmPickup(false)
      await invalidate()
      showInternalToast(
        m.intake_detail_advance_done({
          number: updated.orderNumber,
          status: INTAKE_STATUS_LABELS[updated.status](),
        }),
      )
    },
    onError: () => showInternalToast(m.intake_detail_action_failed()),
  })

  const remove = useMutation({
    mutationFn: () => deleteIntakeOrder(order.id),
    onSuccess: async () => {
      setConfirmRemove(false)
      await invalidate()
      showInternalToast(m.intake_detail_removed_toast({ number: order.orderNumber }))
      await navigate({ to: '/prijem' })
    },
    onError: () => showInternalToast(m.intake_detail_action_failed()),
  })

  return (
    <header className="flex flex-wrap items-start gap-4">
      <div className="min-w-0">
        <Link
          to="/prijem"
          className="mb-2 inline-block font-mono text-[11px] text-mri-text2 transition-colors hover:text-mri-text"
        >
          {m.intake_detail_back()}
        </Link>

        <div className="flex flex-wrap items-center gap-[13px]">
          <h1 className="font-mono text-[27px] font-extrabold tracking-[-0.02em] text-mri-text">
            {order.orderNumber}
          </h1>

          {/* An unfinished intake has no meaningful status yet — it is `primljeno` only by column
              default — so it carries the draft marker instead, exactly as the list decided. Printing
              a blue PRIMLJENO directly above the amber "Nedovršen · korak 3 od 5" bar made the same
              order say two different things, and the pill is what gets read first. The STEP is
              deliberately not repeated here — the bar an inch below carries it, and in the browser
              the pair read as the same sentence printed twice. */}
          {order.signedAt === null ? (
            <InternalPill tone="warn" dot className={STATUS_PILL_CLASSES}>
              {m.intake_row_draft()}
            </InternalPill>
          ) : (
            <InternalPill
              tone={INTAKE_STATUS_TONES[order.status]}
              dot
              className={STATUS_PILL_CLASSES}
            >
              {INTAKE_STATUS_LABELS[order.status]()}
            </InternalPill>
          )}

          <InternalPill tone="neutral" className="border border-mri-border2 px-[9px] py-1">
            {INTAKE_VEHICLE_TYPE_LABELS[order.vehicleType]()}
          </InternalPill>

          {order.amendedAt !== null ? (
            <InternalPill
              tone="warn"
              className="border border-[rgba(245,166,35,0.45)] px-[10px] py-1 font-bold"
            >
              {m.intake_detail_amended_badge()}
            </InternalPill>
          ) : null}
        </div>

        <p className="mt-2 text-[14.5px] text-mri-text2">
          {order.vehicle} · <span className="font-mono">{order.plate}</span> · {order.ownerName}
        </p>
      </div>

      <div className="ml-auto flex flex-wrap items-start justify-end gap-2.5">
        {/* The title sits on a live wrapper: a disabled control fires no pointer events and is
            skipped by the tab order, so a title on the button itself is never readable. */}
        <span title={m.intake_detail_print_unavailable()}>
          <InternalButton
            type="button"
            variant="outline"
            disabled
            aria-describedby={PRINT_REASON_ID}
            className={ACTION_CLASSES}
          >
            {m.intake_detail_print()}
          </InternalButton>
          <span id={PRINT_REASON_ID} className="sr-only">
            {m.intake_detail_print_unavailable()}
          </span>
        </span>

        {canAdvance && isLive && next !== null ? (
          <InternalButton
            type="button"
            variant="ghost"
            disabled={advance.isPending}
            onClick={() => (needsPickupConfirm ? setConfirmPickup(true) : advance.mutate())}
            className={cn(ACTION_CLASSES, ADVANCE_CLASSES[next])}
          >
            {m.intake_detail_advance({ status: INTAKE_STATUS_LABELS[next]() })}
          </InternalButton>
        ) : null}

        {canDelete && isLive ? (
          <InternalButton
            type="button"
            variant="outline-red"
            onClick={() => setConfirmRemove(true)}
            className={ACTION_CLASSES}
          >
            {m.intake_detail_remove()}
          </InternalButton>
        ) : null}
      </div>

      {/* `default`, not the dialog's destructive default: a car being collected is the happy end
          of the job, and red would tell the serviser he is about to break something. The status is
          not interpolated — this dialog exists for exactly one destination, and `next` is nullable
          out here. */}
      <ConfirmDialog
        open={confirmPickup}
        onOpenChange={setConfirmPickup}
        variant="default"
        title={m.intake_detail_pickup_title({ number: order.orderNumber })}
        description={m.intake_detail_pickup_description()}
        confirmLabel={m.intake_detail_pickup_confirm()}
        pending={advance.isPending}
        onConfirm={() => advance.mutate()}
      />

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={m.intake_detail_remove_title({ number: order.orderNumber })}
        description={m.intake_detail_remove_description()}
        confirmLabel={m.intake_detail_remove_confirm()}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </header>
  )
}
