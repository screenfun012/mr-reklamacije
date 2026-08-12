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
          {/*
            A plain width, at last. `w-full` was V-6-2's answer to a 1/4-width grid cell that could
            not grow past a fixed control and clipped digits with no scrollbar — but this control is
            no longer in that grid, it sits under it in a block as wide as the card. Against that,
            `w-full` only meant "as wide as the page", which is what pushed the buttons onto their
            own line and left SAČUVAJ floating in the middle of nothing (Nikola, 2026-08-12).
            `max-w-full` keeps the old protection where it still matters: it can always shrink.
          */}
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={m.intake_contact_phone_placeholder()}
            className="mri-input h-10 w-[260px] max-w-full rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 font-sans text-[13.5px] text-mri-text outline-none"
          />
          <InternalButton
            type="button"
            // Filled, not `ghost`: this is the button that commits what was typed, and ghost is
            // borderless and transparent — it rendered as bare text and read as a caption
            // (Nikola, 2026-08-12: „nema smisla, samo tekst stoji"). `primary` is the neutral fill;
            // the brandbook forbids a red one.
            variant="primary"
            // `ghost` and `primary` both carry no sizing of their own — the defaults suit 52px form
            // CTAs, and this one sits inline beside a 40px field.
            className="h-10 w-fit px-5 text-[12.5px] shadow-none"
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
              // Outlined, one step quieter than SAČUVAJ: two filled buttons side by side would ask
              // the reader which one is the action.
              variant="outline"
              className="h-10 w-fit px-4 text-[12.5px]"
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
