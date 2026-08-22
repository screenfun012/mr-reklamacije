import { m } from '@mr/i18n'
import {
  advanceIntakeOrder,
  intakeOrderKeys,
  IntakeOrderStatus,
  type IntakeOrderDetail,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { InternalButton, internalButtonClasses } from '~/components/internal-button'
import { InternalPill } from '~/components/internal-pill'
import { showInternalToast } from '~/lib/internal-toast'

import { INTAKE_VEHICLE_TYPE_LABELS } from '@mr/intake-document'
import { INTAKE_STATUS_LABELS, INTAKE_STATUS_TONES, nextIntakeStatus } from '../intake-status'

const ACTION_CLASSES = 'h-[46px] w-auto px-[18px] text-[13px]'

export interface IntakeDetailHeaderProps {
  order: IntakeOrderDetail
  canAdvance: boolean
  /**
   * `intake_orders.change_status`. Not a second way to nudge the status — it is the OTHER half of
   * the handover screen: the escape there is his, and the signed handover is the `advance` holder's.
   * Whoever holds either must be able to reach the screen, or the person who owns the escape has no
   * door to it. (Today the operator role holds both; the whole point of the split is that it need
   * not stay that way.)
   */
  canChangeStatus: boolean
  /** The page owns the preview, because it is also the thing the wizard's flag lands on. */
  onPrint: () => void
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
  canChangeStatus,
  onPrint,
}: IntakeDetailHeaderProps): ReactElement {
  const queryClient = useQueryClient()

  // Every intake mutation touches the detail, the list, the KPI row AND the history tab, and
  // all four keys hang off one root — invalidating the root cannot forget one of them.
  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })

  const next = nextIntakeStatus(order.status)
  /** The status the button moves to, or `null` when there is nothing for it to do. */
  const nudge =
    canAdvance && order.signedAt !== null && next !== null && next !== IntakeOrderStatus.PickedUp
      ? next
      : null
  /**
   * Signed, and no handover signed yet — which is the normal end of the job AND the vehicle that
   * left without signatures. The screen itself gates on exactly this, so the link and the screen
   * cannot disagree.
   */
  const handoverOpen =
    (canAdvance || canChangeStatus) && order.signedAt !== null && order.handoverSignedAt === null

  const advance = useMutation({
    mutationFn: () => advanceIntakeOrder(order.id),
    onSuccess: async (updated) => {
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
        </div>

        <p className="mt-2 text-[14.5px] text-mri-text2">
          {order.vehicle} · <span className="font-mono">{order.plate}</span> · {order.ownerName}
        </p>
      </div>

      {/* `[&>*]:grow`, not `[&>button]:grow` as the claim detail has it: one of these three is a
          Link. It only ever fires on a line narrower than the buttons' own width — a phone, where
          the row wrapped and left PRIMOPREDAJA alone against the right edge. */}
      <div className="ml-auto flex flex-wrap items-start justify-end gap-2.5 [&>*]:grow">
        {/* Signed orders only: the paper is the signed record handed to the owner, and a draft has
            nothing signed to hand over. */}
        {order.signedAt === null ? null : (
          <InternalButton
            type="button"
            variant="outline"
            onClick={onPrint}
            className={ACTION_CLASSES}
          >
            {m.intake_detail_print()}
          </InternalButton>
        )}

        {/* The status nudge, and it stops one rung short: `preuzeto` belongs to the handover, and
            the server refuses it here (`IntakeOrdersService.advance`). */}
        {nudge === null ? null : (
          <InternalButton
            type="button"
            variant="ghost"
            disabled={advance.isPending}
            onClick={() => advance.mutate()}
            className={cn(ACTION_CLASSES, ADVANCE_CLASSES[nudge])}
          >
            {m.intake_detail_advance({ status: INTAKE_STATUS_LABELS[nudge]() })}
          </InternalButton>
        )}

        {/* The way to the handover screen, and the ONLY one — so it also has to be there for the
            vehicle that was already released without signatures. That repair is deliberate (the
            owner turns up at 19:00, the office lets him go, the two of them sign the next morning),
            the service allows it by keying on the signature rather than the status, and without
            this link it would exist only for someone who types the URL. It is a different act, so
            it says so: nothing is being handed over any more, the missing record is being made. */}
        {handoverOpen ? (
          <Link
            to="/prijem/$id/primopredaja"
            params={{ id: order.id }}
            className={internalButtonClasses(
              'ghost',
              cn(ACTION_CLASSES, ADVANCE_CLASSES[IntakeOrderStatus.PickedUp]),
            )}
          >
            {order.status === IntakeOrderStatus.PickedUp
              ? m.intake_handover_open_late()
              : m.intake_handover_open()}
          </Link>
        ) : null}
      </div>
    </header>
  )
}
