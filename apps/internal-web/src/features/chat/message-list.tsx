import { m } from '@mr/i18n'
import type { ChatMessage, MrRegistryExistingClaim } from '@mr/shared'
import { ArrowDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { MessageRow } from './message-row'
import { useMrResolutions } from './use-mr-resolutions'

/**
 * How close to the bottom still counts as "reading the newest".
 *
 * The whole reason it is not zero: a person at the bottom of a live conversation must be carried
 * along, and a person who scrolled up to read something must NOT be — moving the page under a
 * reader is worse than a missed message, because he loses the line he was on and cannot get it back.
 */
const AT_BOTTOM_THRESHOLD_PX = 80

export interface PendingChatMessage {
  message: ChatMessage
  failed: boolean
  /**
   * The files this row is still carrying, kept as the browser's own `File` objects.
   *
   * They cannot live on `message.attachments` — that is the shape the SERVER answers with, and
   * nothing here has an id or a stored path yet. They are handed back to the mutation on a retry,
   * which is why a failed send can be pressed again without picking the photos a second time.
   */
  files: readonly File[]
}

export interface MessageListProps {
  messages: readonly ChatMessage[]
  pending: readonly PendingChatMessage[]
  /** The message the amber NOVO rule is drawn above, or null when everything here was read. */
  novoBeforeId: string | null
  onRetry: (clientMsgId: string) => void
  /** Opens a photo full size. Passed straight down to every row. */
  onOpenImage?: ((message: ChatMessage, attachmentId: string) => void) | undefined
  /** Where a click on an MR number goes. Absent leaves the chips drawn but inert. */
  onOpenClaim?: ((target: MrRegistryExistingClaim) => void) | undefined
  /** Absent where there is no composer to answer in. */
  onReply?: ((message: ChatMessage) => void) | undefined
  onReact?: ((message: ChatMessage) => void) | undefined
  onPin?: ((message: ChatMessage) => void) | undefined
  /**
   * The message ids on the room's shortlist, and which of them THIS person may take down. Passed
   * as sets rather than a flag per message: pins live on the conversation, not on the message, so
   * the row cannot read its own state.
   */
  pinnedIds?: ReadonlySet<string>
  unpinnableIds?: ReadonlySet<string>
  /** Whose messages get the ticks. */
  currentUserId?: string | undefined
}

function NovoSeparator(): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="h-px flex-1 bg-[rgba(234,179,8,.4)]" />
      <span className="font-mono text-[8.5px] font-bold tracking-[0.18em] text-mri-warn">
        {m.chat_novo_separator()}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-[rgba(234,179,8,.4)]" />
    </div>
  )
}

/** The scrolling half of a conversation: what was said, and whether you are still at the bottom. */
export function MessageList({
  messages,
  pending,
  novoBeforeId,
  onRetry,
  onOpenImage,
  onOpenClaim,
  onReply,
  onReact,
  onPin,
  pinnedIds,
  unpinnableIds,
  currentUserId,
}: MessageListProps): React.ReactElement {
  // One resolution pass for everything on screen, the message being written included.
  const bodies = useMemo(
    () => [...messages.map((item) => item.body), ...pending.map((row) => row.message.body)],
    [messages, pending],
  )
  const resolutions = useMrResolutions(bodies)

  const paneRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [showJump, setShowJump] = useState(false)

  const scrollToBottom = (): void => {
    const pane = paneRef.current
    if (pane !== null) {
      pane.scrollTop = pane.scrollHeight
    }
  }

  const handleScroll = (): void => {
    const pane = paneRef.current
    if (pane === null) {
      return
    }
    const distance = pane.scrollHeight - pane.scrollTop - pane.clientHeight
    atBottomRef.current = distance <= AT_BOTTOM_THRESHOLD_PX
    setShowJump(!atBottomRef.current)
  }

  // Keyed on what is at the bottom, so a re-render that changed nothing does not scroll.
  const tail = `${messages.at(-1)?.id ?? ''}|${pending.length}`
  useEffect(() => {
    if (!atBottomRef.current) {
      return
    }
    scrollToBottom()
  }, [tail])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={paneRef}
        onScroll={handleScroll}
        role="log"
        aria-label={m.chat_messages_log()}
        aria-live="polite"
        className="flex flex-1 flex-col gap-3.5 overflow-auto px-4 pt-4 pb-2.5"
      >
        {messages.length === 0 && pending.length === 0 ? (
          <p className="m-auto text-center text-[12px] text-mri-text2">{m.chat_messages_empty()}</p>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-3.5">
            {message.id === novoBeforeId ? <NovoSeparator /> : null}
            <MessageRow
              message={message}
              resolutions={resolutions}
              onOpenClaim={onOpenClaim}
              onReply={onReply}
              onReact={onReact}
              onPin={onPin}
              isPinned={pinnedIds?.has(message.id) ?? false}
              canUnpin={unpinnableIds?.has(message.id) ?? false}
              currentUserId={currentUserId}
              onOpenImage={onOpenImage}
            />
          </div>
        ))}

        {pending.map((row) => (
          <MessageRow
            key={row.message.clientMsgId}
            message={row.message}
            resolutions={resolutions}
            onOpenClaim={onOpenClaim}
            pending={!row.failed}
            failed={row.failed}
            onRetry={() => onRetry(row.message.clientMsgId)}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {showJump ? (
        <button
          type="button"
          onClick={() => {
            scrollToBottom()
            atBottomRef.current = true
            setShowJump(false)
          }}
          className="absolute inset-x-0 bottom-3 mx-auto inline-flex w-fit items-center gap-2 rounded-[20px] border border-mri-border bg-mri-raised px-3 py-1.5 font-mono text-[10.5px] font-medium text-mri-text shadow-lg transition-colors hover:border-mri-border2"
        >
          <ArrowDown aria-hidden="true" className="size-3" />
          {m.chat_jump_to_newest()}
        </button>
      ) : null}
    </div>
  )
}
