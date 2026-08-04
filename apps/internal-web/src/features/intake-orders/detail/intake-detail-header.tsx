import { m } from '@mr/i18n'
import {
  advanceIntakeOrder,
  deleteIntakeOrder,
  intakeOrderKeys,
  type IntakeOrderDetail,
} from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
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
}

export function IntakeDetailHeader({
  order,
  canAdvance,
  canDelete,
}: IntakeDetailHeaderProps): ReactElement {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirmRemove, setConfirmRemove] = useState(false)

  // Every intake mutation touches the detail, the list, the KPI row AND the history tab, and
  // all four keys hang off one root — invalidating the root cannot forget one of them.
  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })

  const next = nextIntakeStatus(order.status)
  const isLive = order.deletedAt === null && order.signedAt !== null

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

          <InternalPill
            tone={INTAKE_STATUS_TONES[order.status]}
            dot
            className="px-[11px] py-[5px] text-[10.5px] tracking-[0.08em]"
          >
            {INTAKE_STATUS_LABELS[order.status]()}
          </InternalPill>

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
            variant="primary"
            disabled={advance.isPending}
            onClick={() => advance.mutate()}
            className={ACTION_CLASSES}
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
