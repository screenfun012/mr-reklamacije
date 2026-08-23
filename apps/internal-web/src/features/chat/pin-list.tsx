import { m } from '@mr/i18n'
import { chatPinsOptions, pinChatMessage, chatKeys, type ChatPin } from '@mr/shared'
import { cn } from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pin, X } from 'lucide-react'

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
          className="ml-auto grid size-5 flex-none cursor-pointer place-items-center rounded text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-bad"
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
  const queryClient = useQueryClient()
  const { data } = useQuery(chatPinsOptions(conversationId))
  const items = data?.items ?? []

  const unpin = useMutation({
    mutationFn: (messageId: string) => pinChatMessage(messageId, false),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.pins(conversationId) }),
  })

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
      <div className="absolute right-0 top-[calc(100%+6px)] z-20 flex w-[300px] flex-col gap-2 rounded-xl border border-mri-border bg-mri-raised p-3 shadow-lg">
        <span className="font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2">
          {m.chat_pins_title({ count })}
        </span>
        <PinList conversationId={conversationId} currentUserId={currentUserId} isAdmin={isAdmin} />
      </div>
    </details>
  )
}
