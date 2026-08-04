import { m } from '@mr/i18n'
import { changeIntakeOrderStatus, intakeOrderKeys, type IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

import { INTAKE_STATUS_LABELS, INTAKE_STATUS_ORDER } from '../intake-status'

/**
 * The office's status correction. No confirmation dialog: a status move is small, reversible
 * and already audited, so it fires directly and reports through a toast (§4.2). The caption
 * deliberately drops the prototype's „(KANCELARIJA)" — that is not a role (docs/25 §3.1).
 */
export function IntakeStatusBar({ order }: { order: IntakeOrderDetail }): ReactElement {
  const queryClient = useQueryClient()

  const change = useMutation({
    mutationFn: (status: IntakeOrderDetail['status']) =>
      changeIntakeOrderStatus(order.id, { status }),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
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
    <div className="flex flex-wrap items-center gap-[13px] rounded-[12px] border border-mri-border bg-mri-surface px-4 py-3">
      <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-mri-text2">
        {m.intake_status_bar_caption()}
      </span>

      <div
        role="group"
        aria-label={m.intake_status_bar_caption()}
        className="flex overflow-hidden rounded-[9px] border border-mri-border2"
      >
        {INTAKE_STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={status === order.status}
            disabled={status === order.status || change.isPending}
            onClick={() => change.mutate(status)}
            className={cn(
              'cursor-pointer px-[15px] py-2.5 font-mono text-[11.5px] font-extrabold uppercase tracking-[0.06em] transition-colors disabled:cursor-default',
              status === order.status
                ? 'bg-mri-red text-white'
                : 'bg-transparent text-mri-text2 hover:text-mri-text',
            )}
          >
            {INTAKE_STATUS_LABELS[status]()}
          </button>
        ))}
      </div>

      <span className="ml-auto text-[12.5px] text-mri-text2">{m.intake_status_bar_note()}</span>
    </div>
  )
}
