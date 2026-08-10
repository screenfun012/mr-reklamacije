import { m } from '@mr/i18n'
import { deleteIntakeOrder, intakeOrderKeys, type IntakeOrderDetail } from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type ReactElement } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

import { INTAKE_WIZARD_STEP_COUNT } from '../wizard/intake-wizard-state'

export interface IntakeDraftBarProps {
  order: IntakeOrderDetail
  /**
   * Undefined until the live session resolves. The continue button then stays hidden rather
   * than being offered to the wrong person for a frame — an unfinished intake may only be
   * continued by its own serviser, and the server enforces the same rule (§6.2).
   */
  currentUserId: string | undefined
  canDelete: boolean
}

/**
 * In place of the status bar on an unfinished intake (§4.8). The prototype has no such
 * screen — its detail assumes a signed order — so this is ours, kept deliberately thin.
 */
export function IntakeDraftBar({
  order,
  currentUserId,
  canDelete,
}: IntakeDraftBarProps): ReactElement {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const isOwner = currentUserId !== undefined && currentUserId === order.technicianId

  const discard = useMutation({
    mutationFn: () => deleteIntakeOrder(order.id),
    onSuccess: async () => {
      setConfirmDiscard(false)
      // Drop this order's own query rather than invalidating it. Discarding a draft is a HARD
      // delete, so invalidating `all` refetches the row we just removed, gets a 404, retries it
      // three times with backoff — and the awaited invalidation holds the serviser on a red
      // "Nalog nije pronađen" over a discard that in fact succeeded.
      queryClient.removeQueries({ queryKey: intakeOrderKeys.detail(order.id) })
      await navigate({ to: '/prijem' })
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.lists() })
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.summary() })
    },
    onError: () => showInternalToast(m.intake_discard_failed()),
  })

  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[12px] border border-[rgba(245,166,35,0.26)] bg-[rgba(245,166,35,0.09)] px-4 py-3.5">
      <span className="flex-none font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-mri-warn">
        {m.intake_draft_tag()}
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] text-mri-text">
        {m.intake_detail_draft_step({
          step: order.draftStep ?? 1,
          total: INTAKE_WIZARD_STEP_COUNT,
        })}
      </span>

      {isOwner ? (
        <Link
          to="/prijem/novi"
          search={{ resume: order.id }}
          className="h-[42px] flex-none rounded-[9px] border border-[rgba(245,166,35,0.45)] px-[18px] font-mono text-xs font-extrabold uppercase leading-[42px] tracking-[0.08em] text-mri-warn"
        >
          {m.intake_draft_resume()}
        </Link>
      ) : null}

      {/* The office cleans up after a serviser who left the firm — docs/25 §3.3.5. */}
      {isOwner || canDelete ? (
        <button
          type="button"
          onClick={() => setConfirmDiscard(true)}
          className="h-[42px] flex-none cursor-pointer rounded-[9px] border border-mri-border2 px-[18px] font-mono text-xs font-bold uppercase tracking-[0.08em] text-mri-text2 transition-colors hover:text-mri-text"
        >
          {m.intake_action_discard()}
        </button>
      ) : null}

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={m.intake_discard_title()}
        description={m.intake_discard_description()}
        confirmLabel={m.intake_action_discard()}
        pending={discard.isPending}
        onConfirm={() => discard.mutate()}
      />
    </div>
  )
}
