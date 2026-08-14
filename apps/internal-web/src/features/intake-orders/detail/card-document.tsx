import { getLocale, m } from '@mr/i18n'
import {
  buildIntakeDocumentUrl,
  intakeOrderKeys,
  sendIntakeOrderDocument,
  type IntakeOrderDetail,
} from '@mr/shared'
import { cn, ConfirmDialog } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactElement } from 'react'

import { InternalButton, internalButtonClasses } from '~/components/internal-button'
import { formatIntakeReceivedAtLong } from '../intake-status'
import { showInternalToast } from '~/lib/internal-toast'
import { CAPTION, CARD } from './detail-styles'

/**
 * The sealed sheet: whether it exists, whether the owner has it, and the two things the office can
 * do about it.
 *
 * Nothing for a draft — there is no signed sheet to seal — and a signed order whose file is not
 * there yet says so rather than showing a dead button: sealing happens in the background right after
 * signing, so this window is seconds long and only ever seen by someone standing on the page as it
 * happens.
 */
export function CardDocument({
  order,
  canSend,
}: {
  order: IntakeOrderDetail
  /** `intake_orders.send_document` — its own permission, because this one leaves the shop. */
  canSend: boolean
}): ReactElement | null {
  const queryClient = useQueryClient()
  const [confirmSend, setConfirmSend] = useState(false)

  const send = useMutation({
    mutationFn: () => sendIntakeOrderDocument(order.id),
    onSuccess: async () => {
      setConfirmSend(false)
      // The stamp lives on the order, and Istorija learns of the send from its audit row.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: intakeOrderKeys.detail(order.id) }),
        queryClient.invalidateQueries({ queryKey: intakeOrderKeys.history(order.id) }),
      ])
      showInternalToast(m.intake_document_sent())
    },
    onError: () => {
      setConfirmSend(false)
      showInternalToast(m.intake_detail_action_failed())
    },
  })

  if (order.signedAt === null) {
    return null
  }

  const sentAt = order.documentEmailedAt

  return (
    <section className={cn(CARD, 'flex flex-col gap-[11px] px-[18px] py-4')}>
      <h2 className={CAPTION}>{m.intake_card_document()}</h2>

      {!order.documentReady ? (
        <p className="text-[13.5px] italic text-mri-text2">{m.intake_document_not_ready()}</p>
      ) : (
        <>
          <p className="text-[13px] text-mri-text2">
            {sentAt !== null
              ? m.intake_document_sent_at({ at: formatIntakeReceivedAtLong(sentAt, getLocale()) })
              : order.ownerEmail === null
                ? m.intake_document_no_email()
                : m.intake_document_never_sent()}
          </p>

          <div className="flex flex-wrap gap-2">
            {/* A link, not a fetch: the response is a file with its own name, and the browser
                already knows what to do with one. Styled through the helper the design system
                provides for exactly this — an anchor that has to look like a button. */}
            <a
              href={buildIntakeDocumentUrl(order.id)}
              className={internalButtonClasses('outline', 'h-9 w-auto px-3 text-[13px]')}
            >
              {m.intake_document_download()}
            </a>

            {canSend && order.ownerEmail !== null ? (
              <InternalButton
                type="button"
                variant="ghost"
                disabled={send.isPending}
                onClick={() => setConfirmSend(true)}
                className="h-9 px-3 text-[13px]"
              >
                {sentAt !== null ? m.intake_document_resend() : m.intake_document_send()}
              </InternalButton>
            ) : null}
          </div>
        </>
      )}

      {/* Confirmed because it leaves the building: an email cannot be recalled, and the office is
          usually pressing this because something already went wrong once. */}
      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={m.intake_document_send_confirm_title()}
        description={m.intake_document_send_confirm_body({ email: order.ownerEmail ?? '' })}
        confirmLabel={m.intake_document_send()}
        onConfirm={() => send.mutate()}
      />
    </section>
  )
}
