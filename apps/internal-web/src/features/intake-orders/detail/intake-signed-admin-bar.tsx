import { m } from '@mr/i18n'
import { type IntakeOrderDetail } from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { useNavigate } from '@tanstack/react-router'
import { useState, type ReactElement } from 'react'

import { InternalButton } from '~/components/internal-button'

import { useArchiveIntakeOrder } from '../use-archive-intake-order'
import { useDiscardIntakeOrder } from '../use-discard-intake-order'

export interface IntakeSignedAdminBarProps {
  order: IntakeOrderDetail
  /** `intake_orders.archive` — the same key that archived it can bring it back. */
  canArchive: boolean
  /** `intake_orders.delete_signed` — in no ready-made package; an admin holds it by bypass. */
  canErase: boolean
}

/**
 * The two things that can be done to a SIGNED order beyond its own workflow, on the order's own
 * screen rather than only in a list row.
 *
 * It exists because archiving was invisible: an archived order looked exactly like any other when
 * opened, said nothing about being archived, and could be brought back only from a row icon in a
 * list view most people never found. If a search sends you here, this bar is what tells you where
 * you are and gives you the way back.
 *
 * Erasing lives here too, and deliberately NOT in the list: it destroys the firm's half of the
 * owner's paper, so it should cost opening the order and reading which one it is.
 */
export function IntakeSignedAdminBar({
  order,
  canArchive,
  canErase,
}: IntakeSignedAdminBarProps): ReactElement | null {
  const navigate = useNavigate()
  const [confirmErase, setConfirmErase] = useState(false)
  const archived = order.archivedAt !== null

  const archive = useArchiveIntakeOrder(() => undefined)
  const erase = useDiscardIntakeOrder(async () => {
    setConfirmErase(false)
    await navigate({ to: '/prijem' })
  })

  // After the hooks, never before them: an early return above a hook changes how many run
  // between renders, and React drops the component's state on the next one.
  if (!archived && !canErase) {
    return null
  }

  return (
    <>
      <div
        data-testid="intake-signed-admin-bar"
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 ${
          archived
            ? 'border-dashed border-[rgba(234,179,8,.4)] bg-mri-warn-bg py-3'
            : 'border-transparent py-0'
        }`}
      >
        {/* Only the archived state has something to say. On a healthy signed order the warning
            belongs in the confirmation, not standing on the screen every day. */}
        <span className="text-[12.5px] font-semibold text-mri-warn">
          {archived ? `⚠ ${m.intake_archived_banner()}` : ''}
        </span>

        <span className="flex flex-wrap items-center gap-2">
          {archived && canArchive ? (
            <InternalButton
              type="button"
              variant="outline"
              className="h-[38px] w-auto px-4 text-[12px]"
              onClick={() => archive.mutate({ id: order.id, archived: false })}
              disabled={archive.isPending}
            >
              {m.intake_unarchive_action()}
            </InternalButton>
          ) : null}

          {canErase ? (
            <InternalButton
              type="button"
              variant="outline-red"
              className="h-[38px] w-auto px-4 text-[12px]"
              onClick={() => setConfirmErase(true)}
              disabled={erase.isPending}
            >
              {m.intake_erase_action()}
            </InternalButton>
          ) : null}
        </span>
      </div>

      <ConfirmDialog
        open={confirmErase}
        onOpenChange={setConfirmErase}
        title={m.intake_erase_title({ number: order.orderNumber })}
        description={m.intake_erase_description()}
        confirmLabel={m.intake_erase_action()}
        variant="destructive"
        pending={erase.isPending}
        onConfirm={() => erase.mutate(order.id)}
      />
    </>
  )
}
