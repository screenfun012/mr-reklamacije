import { m } from '@mr/i18n'
import { intakeOrderKeys, updateIntakeOrder, type IntakeOrderDetail } from '@mr/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactElement } from 'react'

import { InternalButton } from '~/components/internal-button'
import { showInternalToast } from '~/lib/internal-toast'

/**
 * The number the shop may write down when the signed one turns out to be wrong. The signed number
 * is evidence and stays exactly as the owner signed it (docs/25 §5) — so it stays on screen, and
 * stays labelled as the signed one. Without that label the added number quietly takes its place,
 * and the divergence the freeze exists to prevent walks back in through the side door.
 *
 * A draft renders nothing: there the real field is still editable, and a second place to type the
 * same thing is a hole the screen would have to explain (docs/25 §3.0).
 */
export function IntakeContactPhone({
  order,
  canUpdate,
}: {
  order: IntakeOrderDetail
  canUpdate: boolean
}): ReactElement | null {
  const queryClient = useQueryClient()
  const detailKey = intakeOrderKeys.detail(order.id)
  const [draft, setDraft] = useState(order.contactPhone ?? '')

  const save = useMutation({
    mutationFn: (value: string | null) => updateIntakeOrder(order.id, { contactPhone: value }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(detailKey, updated)
      // The PATCH writes a `contact_added` audit row, and Istorija has no other way to learn of it.
      await queryClient.invalidateQueries({ queryKey: intakeOrderKeys.history(order.id) })
      showInternalToast(m.intake_contact_phone_saved())
    },
    onError: () => showInternalToast(m.intake_detail_action_failed()),
  })

  if (order.signedAt === null) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase text-mri-text2">
        {m.intake_contact_phone_label()}
      </span>

      {canUpdate ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* `w-full`, not a fixed min-width: a floor in px fights a grid column that cannot grow
              past it, and the loser is invisible — no scrollbar, just clipped digits (V-6-2). A
              percentage width can never overflow its own row, whatever that row's cell turns out
              to be.
              A CEILING is a different thing and does not undo that: the cell spans the whole card,
              so `w-full` alone drew a phone box the width of the page and read as a mistake
              (Nikola, 2026-08-12). It still shrinks freely; it just stops growing. */}
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={m.intake_contact_phone_placeholder()}
            className="mri-input w-full max-w-[280px] rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 py-2 font-sans text-[13.5px] text-mri-text outline-none"
          />
          <InternalButton
            type="button"
            variant="ghost"
            // The server has no no-op guard on this PATCH — it writes and audits whatever arrives —
            // so a second press on an unchanged value would append a second `contact_added` row to
            // Istorija for nothing. Comparing against the stored value keeps that write meaningful.
            disabled={
              save.isPending ||
              draft.trim().length < 3 ||
              draft.trim() === (order.contactPhone ?? '')
            }
            onClick={() => save.mutate(draft.trim())}
          >
            {m.intake_contact_phone_save()}
          </InternalButton>
          {order.contactPhone === null ? null : (
            <InternalButton
              type="button"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => {
                setDraft('')
                save.mutate(null)
              }}
            >
              {m.intake_contact_phone_clear()}
            </InternalButton>
          )}
        </div>
      ) : (
        <span className="text-[13.5px] text-mri-text">{order.contactPhone ?? '—'}</span>
      )}

      {/* Never hidden, never quieter than the added number: the paper says this one. */}
      <span className="text-[12px] text-mri-text2">
        {m.intake_contact_phone_signed_hint({ phone: order.ownerPhone })}
      </span>
    </div>
  )
}
