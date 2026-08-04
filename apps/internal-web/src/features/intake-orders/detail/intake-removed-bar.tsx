import { m } from '@mr/i18n'
import { ApiError, intakeOrderKeys, restoreIntakeOrder, type IntakeOrderDetail } from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

/**
 * Restore needs no confirmation — it is the constructive direction (§4.9). The 409 is worded
 * from the order's own number: removing an order releases it, so the number the reader must
 * free is the one printed on this very order. The server's conflict `details` carries the
 * clashing order's uuid and nothing a person could read.
 */
export function IntakeRemovedBar({ order }: { order: IntakeOrderDetail }): ReactElement {
  const queryClient = useQueryClient()

  const restore = useMutation({
    mutationFn: () => restoreIntakeOrder(order.id),
    onSuccess: async (restored) => {
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.all })
      showInternalToast(m.intake_detail_restore_done({ number: restored.orderNumber }))
    },
    onError: (error) => {
      showInternalToast(
        error instanceof ApiError && error.status === 409
          ? m.intake_detail_restore_conflict({ number: order.orderNumber })
          : m.intake_detail_action_failed(),
      )
    },
  })

  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[12px] border border-mri-border2 bg-mri-inbg px-4 py-3.5">
      <span className="min-w-0 flex-1 text-[13.5px] text-mri-text2">
        {m.intake_detail_removed_note()}
      </span>
      <button
        type="button"
        disabled={restore.isPending}
        onClick={() => restore.mutate()}
        className="h-[42px] flex-none cursor-pointer rounded-[9px] border border-mri-border2 px-[18px] font-mono text-xs font-extrabold uppercase tracking-[0.08em] text-mri-text transition-colors hover:border-mri-red hover:text-mri-redh disabled:cursor-not-allowed disabled:opacity-60"
      >
        {m.intake_detail_restore()}
      </button>
    </div>
  )
}
