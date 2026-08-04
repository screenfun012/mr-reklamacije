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
export interface IntakeRemovedBarProps {
  order: IntakeOrderDetail
  /**
   * Safe without it — `loadVisible` only includes removed orders for a `delete` holder, so nobody
   * else reaches this bar at all. Passed anyway because it was the one action on the screen whose
   * courtesy gate lived in another file, and reading this one gave no hint of why.
   */
  canDelete: boolean
}

export function IntakeRemovedBar({ order, canDelete }: IntakeRemovedBarProps): ReactElement {
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
      {canDelete ? (
        <button
          type="button"
          disabled={restore.isPending}
          onClick={() => restore.mutate()}
          className="h-[42px] flex-none cursor-pointer rounded-[9px] border border-mri-border2 px-[18px] font-mono text-xs font-extrabold uppercase tracking-[0.08em] text-mri-text transition-colors hover:border-mri-red hover:text-mri-redh disabled:cursor-not-allowed disabled:opacity-60"
        >
          {m.intake_detail_restore()}
        </button>
      ) : null}
    </div>
  )
}
