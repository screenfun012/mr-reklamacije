import { m } from '@mr/i18n'
import type { ChatMessage } from '@mr/shared'
import { ArrowDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { MessageRow } from './message-row'

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
}

export interface MessageListProps {
  messages: readonly ChatMessage[]
  pending: readonly PendingChatMessage[]
  /** The message the amber NOVO rule is drawn above, or null when everything here was read. */
  novoBeforeId: string | null
  onRetry: (clientMsgId: string) => void
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
}: MessageListProps): React.ReactElement {
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
            <MessageRow message={message} />
          </div>
        ))}

        {pending.map((row) => (
          <MessageRow
            key={row.message.clientMsgId}
            message={row.message}
            pending={!row.failed}
            failed={row.failed}
            onRetry={() => onRetry(row.message.clientMsgId)}
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
