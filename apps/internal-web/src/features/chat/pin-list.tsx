import { m } from '@mr/i18n'
import { chatPinsOptions, pinChatMessage, chatKeys, type ChatPin } from '@mr/shared'
import { cn } from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pin, X } from 'lucide-react'

import { AttachmentOnlyExcerpt } from './message-attachments'

function useUnpin(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) => pinChatMessage(messageId, false),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.pins(conversationId) }),
  })
}

/** L169/L170: who said it in mono, then the words, in an `--inbg` card with a hairline. */
function PinRow({
  pin,
  onUnpin,
}: {
  pin: ChatPin
  onUnpin: (() => void) | undefined
}): React.ReactElement {
  return (
    <span className="flex items-start gap-1.5 rounded-lg border border-mri-border2 bg-mri-inbg px-2.5 py-2">
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="font-mono text-[9px] font-semibold text-mri-text2">{pin.authorName}</span>
        <span className="text-[11.5px] leading-[1.5] text-mri-text">
          {/* A withdrawn message keeps its place on the shortlist and loses its words — the same
              rule a quoted block follows. */}
          {pin.isDeleted ? (
            <em className="text-mri-text2">{m.chat_message_deleted()}</em>
          ) : pin.excerpt === '' && pin.hasAttachment ? (
            <AttachmentOnlyExcerpt />
          ) : (
            pin.excerpt
          )}
        </span>
      </span>
      {onUnpin === undefined ? null : (
        <button
          type="button"
          title={m.chat_unpin()}
          onClick={onUnpin}
          className="relative ml-auto grid size-5 flex-none cursor-pointer place-items-center rounded text-mri-text2 transition-colors after:absolute after:-inset-2.5 hover:bg-mri-rowhv hover:text-mri-bad"
        >
          <X aria-hidden="true" className="size-3" />
          <span className="sr-only">{m.chat_unpin()}</span>
        </button>
      )}
    </span>
  )
}

/**
 * Every pinned message in one room, and the ✕ for the ones this person may take down.
 *
 * Shared by the two places the prototype puts them: the header's `PIN · N` (L87, every
 * conversation) and the thread panel's PRIKAČENO block (L167–L171, claim threads only). One
 * component, because they draw the same rows from the same query — and a second copy is how the
 * two would end up disagreeing about who may unpin.
 */
export function PinList({
  conversationId,
  currentUserId,
  isAdmin,
  className,
}: {
  conversationId: string
  currentUserId: string
  isAdmin: boolean
  className?: string
}): React.ReactElement {
  const { data } = useQuery(chatPinsOptions(conversationId))
  const items = data?.items ?? []
  const unpin = useUnpin(conversationId)

  if (items.length === 0) {
    return <p className={cn('text-[11.5px] text-mri-text2', className)}>{m.chat_pins_empty()}</p>
  }

  return (
    <span className={cn('flex flex-col gap-1.5', className)}>
      {items.map((pin) => (
        <PinRow
          key={pin.id}
          pin={pin}
          onUnpin={
            isAdmin || pin.pinnedBy === currentUserId ? () => unpin.mutate(pin.id) : undefined
          }
        />
      ))}
    </span>
  )
}

/**
 * The header's shortlist button (prototype L87): mono `600 9px tracking .1em`, `--inbg` over
 * `--border2`, `padding:5px 10px`, radius 7, an 11px pin glyph, then „PIN · N".
 *
 * ⚠ A native `<details>`, not a popover: it opens, it closes, it is reachable by keyboard, and it
 * costs no outside-click listener and no state. It stays open until the button is pressed again,
 * which for a list of at most twenty lines is the honest behaviour rather than a missing one.
 */
export function PinListButton({
  conversationId,
  currentUserId,
  isAdmin,
}: {
  conversationId: string
  currentUserId: string
  isAdmin: boolean
}): React.ReactElement | null {
  const { data } = useQuery(chatPinsOptions(conversationId))
  const count = data?.items.length ?? 0

  // Nothing pinned, nothing to open. The prototype draws the button unconditionally, but its
  // fixtures always have pins — an empty one would open onto a sentence saying so.
  if (count === 0) {
    return null
  }

  return (
    <details className="relative">
      <summary className="flex h-[26px] cursor-pointer list-none items-center gap-1.5 rounded-[7px] border border-mri-border2 bg-mri-inbg px-2.5 font-mono text-[9px] font-semibold tracking-[0.1em] text-mri-text2 transition-colors hover:text-mri-text [&::-webkit-details-marker]:hidden">
        <Pin aria-hidden="true" className="size-[11px]" />
        {m.chat_pins({ count })}
      </summary>
      {/* 20 = the 8px rows + 12px padding, so the popover's corner follows its content's. */}
      <div className="absolute right-0 top-[calc(100%+6px)] z-20 flex w-[300px] flex-col gap-2 rounded-[20px] border border-mri-border bg-mri-raised p-3 shadow-lg">
        <span className="font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2">
          {m.chat_pins_title({ count })}
        </span>
        <PinList conversationId={conversationId} currentUserId={currentUserId} isAdmin={isAdmin} />
      </div>
    </details>
  )
}

/**
 * The pinned message, in a bar under the conversation header, where it can be READ.
 *
 * Nikola, 2026-08-24: „nemamo kako da pinujemo poruku da se uvek vidi u smislu šta piše". The
 * `PIN · N` button opens a shortlist, which answers "what is pinned" only for somebody who
 * already went looking — and a pin exists precisely so that nobody has to.
 *
 * The NEWEST one is the one on the bar: a pin is put up because it matters now, and a bar that
 * grew a line per pin would push the conversation off the screen. When there are more, the bar
 * says so and opening it is the `PIN · N` button's job — one line, one truth, no second control
 * that has to agree with the first.
 */
export function PinnedBar({
  conversationId,
  currentUserId,
  isAdmin,
  isLocked = false,
}: {
  conversationId: string
  currentUserId: string
  isAdmin: boolean
  isLocked?: boolean
}): React.ReactElement | null {
  const { data } = useQuery(chatPinsOptions(conversationId))
  const items = data?.items ?? []
  const newest = items[0]
  const unpin = useUnpin(conversationId)

  if (newest === undefined) {
    return null
  }

  return (
    <div className="flex flex-none items-center gap-2.5 border-b border-mri-border bg-mri-inbg px-4 py-2">
      <Pin aria-hidden="true" className="size-[13px] flex-none text-mri-red" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2">
          {m.chat_pinned_bar()}
          {items.length > 1 ? ` · ${String(items.length)}` : ''}
        </span>
        {/* One line, cut with an ellipsis: the bar is a reminder, and the whole message is three
            centimetres below it in the conversation itself. */}
        <span className="truncate text-[12px] leading-[1.5] text-mri-text">
          <span className="font-semibold text-mri-text2">{newest.authorName}: </span>
          {newest.isDeleted ? (
            <em className="text-mri-text2">{m.chat_message_deleted()}</em>
          ) : newest.excerpt === '' && newest.hasAttachment ? (
            <AttachmentOnlyExcerpt />
          ) : (
            newest.excerpt
          )}
        </span>
      </span>
      {!isLocked && (isAdmin || newest.pinnedBy === currentUserId) ? (
        <button
          type="button"
          title={m.chat_unpin()}
          aria-label={m.chat_unpin()}
          disabled={unpin.isPending}
          onClick={() => unpin.mutate(newest.id)}
          className="relative grid size-7 flex-none cursor-pointer place-items-center rounded-md text-mri-text2 transition-colors after:absolute after:-inset-1.5 hover:bg-mri-rowhv hover:text-mri-bad disabled:cursor-wait disabled:opacity-50"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
