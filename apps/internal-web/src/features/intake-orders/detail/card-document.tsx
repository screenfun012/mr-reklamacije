import { getLocale, m } from '@mr/i18n'
import {
  buildIntakeDocumentUrl,
  intakeOrderKeys,
  produceIntakeOrderDocument,
  sendIntakeOrderDocument,
  type IntakeDocumentKind,
  type IntakeOrderDetail,
} from '@mr/shared'
import { cn, ConfirmDialog } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactElement } from 'react'

import { InternalButton, internalButtonClasses } from '~/components/internal-button'
import { formatIntakeReceivedAtLong } from '../intake-status'
import { showInternalToast } from '~/lib/internal-toast'
import { CAPTION, CARD, FIELD_KEY } from './detail-styles'

const DOCUMENT_LABELS: Record<IntakeDocumentKind, () => string> = {
  intake: m.intake_document_kind_intake,
  handover: m.intake_document_kind_handover,
}

/**
 * One sealed paper: whether it exists, whether the owner has it, and the two things the office can
 * do about it.
 *
 * A document whose file is not there yet says so rather than showing a dead button: sealing happens
 * in the background right after the signatures, so this window is seconds long and only ever seen by
 * someone standing on the page as it happens.
 */
function DocumentRow({
  orderId,
  kind,
  ready,
  emailedAt,
  ownerEmail,
  canSend,
  onSend,
  onProduce,
  producing,
}: {
  orderId: string
  kind: IntakeDocumentKind
  ready: boolean
  emailedAt: string | null
  ownerEmail: string | null
  canSend: boolean
  onSend: (kind: IntakeDocumentKind) => void
  onProduce: (kind: IntakeDocumentKind) => void
  producing: boolean
}): ReactElement {
  return (
    <div className="flex flex-col gap-[9px]">
      <div className={FIELD_KEY}>{DOCUMENT_LABELS[kind]()}</div>

      {!ready ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[13.5px] italic text-mri-text2">{m.intake_document_not_ready()}</p>

          {/* The seal runs in the background behind a signature, so this window is normally seconds
              long — but when it fails there is no second attempt of its own, and this sentence used
              to sit here forever. Pressing early is harmless: the call joins the running seal rather
              than starting a second one. */}
          {canSend ? (
            <InternalButton
              type="button"
              variant="outline"
              disabled={producing}
              onClick={() => onProduce(kind)}
              className="h-9 px-3 text-[13px]"
            >
              {m.intake_document_produce()}
            </InternalButton>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-[13px] text-mri-text2">
            {emailedAt !== null
              ? m.intake_document_sent_at({
                  at: formatIntakeReceivedAtLong(emailedAt, getLocale()),
                })
              : ownerEmail === null
                ? m.intake_document_no_email()
                : m.intake_document_never_sent()}
          </p>

          <div className="flex flex-wrap gap-2">
            {/* A link, not a fetch: the response is a file with its own name, and the browser
                already knows what to do with one. Styled through the helper the design system
                provides for exactly this — an anchor that has to look like a button. */}
            <a
              href={buildIntakeDocumentUrl(orderId, kind)}
              className={internalButtonClasses('outline', 'h-9 w-auto px-3 text-[13px]')}
            >
              {m.intake_document_download()}
            </a>

            {canSend && ownerEmail !== null ? (
              <InternalButton
                type="button"
                variant="ghost"
                onClick={() => onSend(kind)}
                className="h-9 px-3 text-[13px]"
              >
                {emailedAt !== null ? m.intake_document_resend() : m.intake_document_send()}
              </InternalButton>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * The order's papers. One row while the vehicle is in the shop, two once it has gone back — and the
 * second one appears only where it exists: a vehicle released without signatures never gets a
 * handover sheet, and a row promising one that is "being prepared" would wait forever.
 *
 * Nothing at all for a draft; there is no signed sheet to seal.
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
  /** Which paper is being confirmed — and `null` for "no dialog open". */
  const [confirmSend, setConfirmSend] = useState<IntakeDocumentKind | null>(null)

  const send = useMutation({
    mutationFn: (kind: IntakeDocumentKind) => sendIntakeOrderDocument(order.id, kind),
    onSuccess: async () => {
      setConfirmSend(null)
      // The stamp lives on the order, and Istorija learns of the send from its audit row.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: intakeOrderKeys.detail(order.id) }),
        queryClient.invalidateQueries({ queryKey: intakeOrderKeys.history(order.id) }),
      ])
      showInternalToast(m.intake_document_sent())
    },
    onError: () => {
      setConfirmSend(null)
      showInternalToast(m.intake_detail_action_failed())
    },
  })

  /**
   * The way back from a seal that failed. No confirmation: unlike sending, this reaches nobody
   * outside the shop and cannot be got wrong — a document that exists is never re-rendered.
   */
  const produce = useMutation({
    mutationFn: (kind: IntakeDocumentKind) => produceIntakeOrderDocument(order.id, kind),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: intakeOrderKeys.detail(order.id) }),
        queryClient.invalidateQueries({ queryKey: intakeOrderKeys.history(order.id) }),
      ])
      showInternalToast(m.intake_document_produced())
    },
    onError: () => showInternalToast(m.intake_detail_action_failed()),
  })

  if (order.signedAt === null) {
    return null
  }

  return (
    <section className={cn(CARD, 'flex flex-col gap-[13px] px-[18px] py-4')}>
      <h2 className={CAPTION}>{m.intake_card_document()}</h2>

      <DocumentRow
        orderId={order.id}
        kind="intake"
        ready={order.documentReady}
        emailedAt={order.documentEmailedAt}
        ownerEmail={order.ownerEmail}
        canSend={canSend}
        onSend={setConfirmSend}
        onProduce={produce.mutate}
        producing={produce.isPending}
      />

      {order.handoverSignedAt === null ? null : (
        <div className="border-t border-mri-border pt-[13px]">
          <DocumentRow
            orderId={order.id}
            kind="handover"
            ready={order.handoverDocumentReady}
            emailedAt={order.handoverDocumentEmailedAt}
            ownerEmail={order.ownerEmail}
            canSend={canSend}
            onSend={setConfirmSend}
            onProduce={produce.mutate}
            producing={produce.isPending}
          />
        </div>
      )}

      {/* Confirmed because it leaves the building: an email cannot be recalled, and the office is
          usually pressing this because something already went wrong once. The dialog names WHICH
          paper — with two of them on the card, "the document" is no longer an answer. */}
      <ConfirmDialog
        open={confirmSend !== null}
        onOpenChange={(open) => (open ? undefined : setConfirmSend(null))}
        title={m.intake_document_send_confirm_title()}
        description={m.intake_document_send_confirm_body({
          document: confirmSend === null ? '' : DOCUMENT_LABELS[confirmSend](),
          email: order.ownerEmail ?? '',
        })}
        confirmLabel={m.intake_document_send()}
        pending={send.isPending}
        onConfirm={() => (confirmSend === null ? undefined : send.mutate(confirmSend))}
      />
    </section>
  )
}
