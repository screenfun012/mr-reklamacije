import { getLocale, m } from '@mr/i18n'
import {
  buildIntakeDocumentUrl,
  buildIntakeQuoteUrl,
  intakeOrderKeys,
  produceIntakeOrderDocument,
  removeIntakeQuote,
  sendIntakeOrderDocument,
  sendIntakeQuote,
  type IntakeDocumentKind,
  type IntakeOrderDetail,
} from '@mr/shared'
import { cn, ConfirmDialog } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactElement } from 'react'

import { InternalButton, internalButtonClasses } from '~/components/internal-button'
import { formatIntakeReceivedAtLong } from '../intake-status'
import { showInternalToast } from '~/lib/internal-toast'
import { uploadIntakeQuote } from '../upload-intake-quote'
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
  canAttachQuote,
}: {
  order: IntakeOrderDetail
  /** `intake_orders.send_document` — its own permission, because this one leaves the shop. */
  canSend: boolean
  /** `intake_orders.attach_quote` — reading the quote takes nothing; putting one on does. */
  canAttachQuote: boolean
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
   * The way back from a seal that failed — and it DOES reach the owner: producing the paper delivers
   * it in the same job, exactly as the signature's own seal does. That is the point rather than a
   * side effect, since the missing thing is the owner's copy.
   *
   * No confirmation even so, unlike the send button beside it. That one asks because it is a
   * deliberate second delivery of a paper the owner already has; this one asks nothing because there
   * is nothing to weigh — the document is missing, and the only reason to press it is to fix that.
   * It cannot be got wrong either: a document that exists is never re-rendered, and a copy already
   * delivered is never sent twice. What actually happened shows on this card a second later, in the
   * row's own line — sent and when, or that the owner left no address.
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
        producing={produce.isPending && produce.variables === 'intake'}
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
            producing={produce.isPending && produce.variables === 'handover'}
          />
        </div>
      )}

      {/* The third paper, and the only one that is not ours: made in another program and brought
          back once the work is known. It sits here rather than under Specifikacija because this is
          where the order's papers are downloaded and sent from, and it needs all three. */}
      <div className="border-t border-mri-border pt-[13px]">
        <QuoteRow order={order} canSend={canSend} canAttach={canAttachQuote} />
      </div>

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

/**
 * The quote row. Three states and nothing in between: nobody attached one, one is attached, or a
 * file is on its way up. Whoever may open the order sees it — the office, the intake desk and the
 * serviser doing the work; a reader who may not attach simply gets no controls, and the server
 * refuses him again if he finds the route anyway.
 */
function QuoteRow({
  order,
  canSend,
  canAttach,
}: {
  order: IntakeOrderDetail
  canSend: boolean
  canAttach: boolean
}): ReactElement {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const refresh = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: intakeOrderKeys.detail(order.id) }),
      queryClient.invalidateQueries({ queryKey: intakeOrderKeys.history(order.id) }),
    ])
  }

  const attach = useMutation({
    mutationFn: (file: File) => uploadIntakeQuote(order.id, file),
    onSuccess: async () => {
      await refresh()
      showInternalToast(m.intake_quote_attached())
    },
    // The server's own sentence: "file too large" and "unsupported type" are both things the
    // office can act on, and a generic failure would send it looking in the wrong place.
    onError: (error: Error) => showInternalToast(error.message),
  })

  const remove = useMutation({
    mutationFn: () => removeIntakeQuote(order.id),
    onSuccess: async () => {
      setConfirmRemove(false)
      await refresh()
      showInternalToast(m.intake_quote_removed())
    },
    onError: () => {
      setConfirmRemove(false)
      showInternalToast(m.intake_detail_action_failed())
    },
  })

  const send = useMutation({
    mutationFn: () => sendIntakeQuote(order.id),
    onSuccess: async () => {
      setConfirmSend(false)
      await refresh()
      showInternalToast(m.intake_quote_sent())
    },
    onError: () => {
      setConfirmSend(false)
      showInternalToast(m.intake_detail_action_failed())
    },
  })

  const quote = order.quote

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={CAPTION}>{m.intake_quote_row()}</span>
        {quote === null ? (
          <span className="text-[12.5px] italic text-mri-text2">{m.intake_quote_none()}</span>
        ) : (
          <a
            href={buildIntakeQuoteUrl(order.id)}
            className="min-w-0 truncate text-[13px] font-semibold text-mri-text underline-offset-2 hover:text-mri-redh hover:underline"
          >
            {quote.fileName}
          </a>
        )}
      </div>

      {quote === null ? null : (
        <span className="font-mono text-[11px] text-mri-text2">
          {m.intake_quote_meta({
            name: quote.uploadedByName ?? '—',
            date: formatIntakeReceivedAtLong(quote.uploadedAt, getLocale()),
          })}
        </span>
      )}

      {canAttach || (canSend && quote !== null) ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canAttach ? (
            <>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  // Cleared right away, or picking the same file twice fires no change event.
                  event.target.value = ''
                  if (file !== undefined) {
                    attach.mutate(file)
                  }
                }}
              />
              <InternalButton
                type="button"
                variant="outline"
                disabled={attach.isPending}
                onClick={() => inputRef.current?.click()}
                className="h-9 px-3 text-[13px]"
              >
                {quote === null ? m.intake_quote_attach() : m.intake_quote_replace()}
              </InternalButton>
            </>
          ) : null}
          {quote !== null && canSend ? (
            <InternalButton
              type="button"
              variant="ghost"
              disabled={send.isPending || order.ownerEmail === null}
              onClick={() => setConfirmSend(true)}
              className="h-9 px-3 text-[13px]"
            >
              {m.intake_quote_send()}
            </InternalButton>
          ) : null}
          {quote !== null && canAttach ? (
            <InternalButton
              type="button"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => setConfirmRemove(true)}
              className="h-9 px-3 text-[13px]"
            >
              {m.intake_quote_remove()}
            </InternalButton>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={(open) => (open ? undefined : setConfirmSend(false))}
        title={m.intake_quote_send_confirm_title()}
        description={m.intake_quote_send_confirm_body({ email: order.ownerEmail ?? '—' })}
        confirmLabel={m.intake_quote_send()}
        pending={send.isPending}
        onConfirm={() => send.mutate()}
      />

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={(open) => (open ? undefined : setConfirmRemove(false))}
        title={m.intake_quote_remove_confirm_title()}
        description={m.intake_quote_remove_confirm_body()}
        confirmLabel={m.intake_quote_remove()}
        variant="destructive"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}
