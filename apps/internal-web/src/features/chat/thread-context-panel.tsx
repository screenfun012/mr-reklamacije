import { m } from '@mr/i18n'
import {
  buildChatAttachmentUrl,
  chatConversationAttachmentsOptions,
  ChatConversationType,
  ClaimDetailTab,
  ClaimKind,
  domaceClaimDetailOptions,
  chatPinsOptions,
  emotiveClaimDetailOptions,
  type ChatConversationListItem,
  type ClaimOutcome,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { CHAT_PANEL_RESPONSIVE_CLASSES } from './chat-layout'
import { PinList } from './pin-list'

import { KindPill } from '~/components/kind-pill'
import { OutcomePill } from '~/components/outcome-pill'

/**
 * The claim a thread is about, as read from the conversation row.
 *
 * `null` for everything else — the general channel and every topic channel. This ONE function is
 * the "only in a thread" rule (prototype L388: `showCtx:!isGeneral&&s.ctxOpen`, where the
 * prototype's `isGeneral` means "has no claim behind it", channels included).
 */
function claimOf(
  conversation: ChatConversationListItem,
): { kind: ClaimKind; claimId: string } | null {
  if (
    conversation.type !== ChatConversationType.Claim ||
    conversation.claimId === null ||
    conversation.claimKind === null
  ) {
    return null
  }
  return { kind: conversation.claimKind, claimId: conversation.claimId }
}

/** L161/L174: the section eyebrows, all three identical. */
const EYEBROW_CLASSES = 'font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2'

/**
 * The ⓘ in the conversation header (L90), which is the only way this panel opens.
 *
 * L390 for both states: 30×30, `border-radius:8px`, and on = `rgba(237,28,36,.5)` border over a
 * `rgba(237,28,36,.13)` fill with `var(--text)` on the glyph; off = `var(--border2)` over nothing
 * with `var(--text2)`.
 */
export function ThreadContextToggle({
  conversation,
  open,
  onToggle,
}: {
  conversation: ChatConversationListItem
  open: boolean
  onToggle: () => void
}): React.ReactElement | null {
  if (claimOf(conversation) === null) {
    return null
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      title={m.chat_context_toggle()}
      aria-label={m.chat_context_toggle()}
      className={cn(
        'flex size-[30px] flex-none items-center justify-center rounded-lg border text-[13px] transition-colors',
        open
          ? 'border-[rgba(237,28,36,.5)] bg-[rgba(237,28,36,.13)] text-mri-text'
          : 'border-mri-border2 bg-transparent text-mri-text2 hover:text-mri-text',
      )}
    >
      <span aria-hidden="true">ⓘ</span>
    </button>
  )
}

function ClaimFacts({
  kind,
  claimId,
  fallbackPartner,
}: {
  kind: ClaimKind
  claimId: string
  fallbackPartner: string
}): React.ReactElement {
  // One of the two is fetched, never both. The claim's own detail already carries the outcome and
  // the assigned worker the panel needs, and whoever may read the thread may read the claim
  // (spec §3.3) — so this needs no wire of its own.
  const emotive = useQuery({
    ...emotiveClaimDetailOptions(claimId),
    enabled: kind === ClaimKind.Emotive,
  })
  const domace = useQuery({
    ...domaceClaimDetailOptions(claimId),
    enabled: kind === ClaimKind.Domace,
  })
  const claim = kind === ClaimKind.Emotive ? emotive.data : domace.data

  return (
    <>
      {claim === undefined ? (
        <div className="h-5 w-24 animate-pulse rounded-full bg-mri-inbg" aria-hidden="true" />
      ) : (
        <span>
          <OutcomePill outcome={claim.outcome as ClaimOutcome} />
        </span>
      )}
      {/* L164 — partner and who is on it, one block of two lines. */}
      <span className="text-[11.5px] leading-[1.5] text-mri-text2">
        <span className="block">{claim?.customerName ?? fallbackPartner}</span>
        <span className="block">
          {m.chat_context_assigned({ name: claim?.employeeName ?? '—' })}
        </span>
      </span>
    </>
  )
}

/**
 * The third column: the claim, beside the conversation about it (prototype L159–L177).
 *
 * It is drawn ONLY for a claim thread. A channel has no claim, so the frame would come out with
 * empty fields and a button that opens nothing — which reads as a broken screen rather than an
 * empty one.
 */
export function ThreadContextPanel({
  conversation,
  currentUserId,
  isAdmin,
}: {
  conversation: ChatConversationListItem
  currentUserId: string
  isAdmin: boolean
}): React.ReactElement | null {
  const pins = useQuery(chatPinsOptions(conversation.id))
  const pinCount = pins.data?.items.length ?? 0

  const claim = claimOf(conversation)
  if (claim === null) {
    return null
  }

  return (
    <aside
      aria-label={m.chat_context_claim()}
      // L159: 250px, hairline on the left, the surface colour, and it scrolls on its own.
      className={cn(
        'flex w-[250px] flex-none flex-col overflow-auto border-l border-mri-border bg-mri-surface',
        'animate-in fade-in-0 slide-in-from-bottom-[9px] duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
        // Below CHAT_PANEL_BREAKPOINT there is no room for a third column, so it lies over the
        // conversation instead of squeezing it. It is opt-in either way (`contextOpen`), so this
        // only decides WHERE it lands, never whether it exists.
        CHAT_PANEL_RESPONSIVE_CLASSES,
      )}
    >
      {/* L160 */}
      <div className="flex flex-col gap-2 border-b border-mri-border px-[14px] pb-3 pt-[14px]">
        <span className={EYEBROW_CLASSES}>{m.chat_context_claim()}</span>
        <span className="flex flex-wrap items-center gap-2">
          {/* L162 — the number is the title the list already carries. */}
          <span className="font-mono text-[15px] font-bold text-mri-text">
            {conversation.title}
          </span>
          <KindPill kind={claim.kind} />
        </span>

        <ClaimFacts
          kind={claim.kind}
          claimId={claim.claimId}
          fallbackPartner={conversation.subtitle}
        />

        {/* L165 */}
        <Link
          to={
            claim.kind === ClaimKind.Emotive
              ? '/reklamacije/emotive/$id'
              : '/reklamacije/domace/$id'
          }
          params={{ id: claim.claimId }}
          search={{ tab: ClaimDetailTab.Pregled }}
          className="mt-0.5 inline-flex h-8 items-center justify-center rounded-lg border border-mri-border2 bg-mri-raised text-[10.5px] font-bold tracking-[0.06em] text-mri-text transition-colors hover:border-mri-text2"
        >
          {m.chat_context_open_claim()}
        </Link>
      </div>

      {/* L167–L171: the shortlist, drawn only when the thread has one. */}
      {pinCount === 0 ? null : (
        <div className="flex flex-col gap-2 border-b border-mri-border px-[14px] py-3">
          <span className={EYEBROW_CLASSES}>{m.chat_pins_title({ count: pinCount })}</span>
          <PinList
            conversationId={conversation.id}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* L173-L174 */}
      <ContextAttachments conversationId={conversation.id} />

      {/* L177 — verbatim, at the bottom of the column whatever else is in it. */}
      <p className="mt-auto border-t border-mri-border px-[14px] py-3 text-[10.5px] italic leading-[1.5] text-mri-text2">
        {m.chat_context_footer()}
      </p>
    </aside>
  )
}

/**
 * The room's shelf: the newest nine files, and „+N" for the rest (`cet-prototip.dc.html` L174 —
 * `repeat(3,1fr)`, gap 6, square, radius 7, the count in mono at 9px).
 *
 * ⚠ `useQuery`, not suspense, and the same reason the pins use it: a shelf that is slow to arrive
 * must never hold up the conversation it belongs beside.
 */
function ContextAttachments({ conversationId }: { conversationId: string }): React.ReactElement {
  const shelf = useQuery(chatConversationAttachmentsOptions(conversationId))
  const items = shelf.data?.items ?? []
  const total = shelf.data?.total ?? 0
  const hidden = Math.max(0, total - items.length)

  return (
    <div className="flex flex-col gap-2 px-[14px] py-3">
      <span className={EYEBROW_CLASSES}>{m.chat_context_attachments({ count: total })}</span>
      {/* ⚠ Three states, not one. Without these the shelf claims „0" and „nothing sent yet" while
          it is still loading — and forever, if the request fails. */}
      {shelf.isPending ? (
        <div className="grid grid-cols-3 gap-[6px]">
          {[0, 1, 2].map((slot) => (
            <div key={slot} className="aspect-square animate-pulse rounded-[7px] bg-mri-inbg" />
          ))}
        </div>
      ) : shelf.isError ? (
        <p className="text-[11.5px] leading-[1.5] text-mri-bad">
          {m.chat_context_attachments_failed()}
        </p>
      ) : items.length === 0 ? (
        <p className="text-[11.5px] leading-[1.5] text-mri-text2">
          {m.chat_context_attachments_none()}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-[6px]">
          {items.map((file) => (
            <a
              key={file.id}
              // ⚠ A download, not a navigation. `inline` walks the whole app out of the room and
              // takes the scroll position, the frozen NOVO rule and the composer draft with it.
              href={buildChatAttachmentUrl(conversationId, file.id, { disposition: 'attachment' })}
              title={file.fileName}
              className="grid aspect-square place-items-center overflow-hidden rounded-[7px] border border-mri-border2 bg-mri-inbg transition-colors hover:border-mri-text2"
            >
              {file.mimeType.startsWith('image/') && file.mimeType !== 'image/heic' ? (
                <img
                  src={buildChatAttachmentUrl(conversationId, file.id, { variant: 'thumbnail' })}
                  alt={file.fileName}
                  className="size-full object-cover"
                />
              ) : (
                <span className="px-1 text-center font-mono text-[9px] font-semibold text-mri-text2">
                  {badgeOf(file.mimeType)}
                </span>
              )}
            </a>
          ))}
          {hidden === 0 ? null : (
            <span className="grid aspect-square place-items-center rounded-[7px] border border-mri-border2 bg-mri-inbg font-mono text-[9px] font-semibold text-mri-text2">
              {`+${hidden}`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Three letters at most — the square is 9px mono. */
function badgeOf(mimeType: string): string {
  if (mimeType === 'application/pdf') {
    return 'PDF'
  }
  return (mimeType.split('/').at(-1) ?? 'FILE').slice(0, 3).toUpperCase()
}
