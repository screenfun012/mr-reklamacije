import {
  CHAT_READ_THROTTLE_MS,
  chatKeys,
  chatMessagesOptions,
  markChatRead,
  sendChatMessage,
  type ChatMessage,
  type ChatMessagesPage,
} from '@mr/shared'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { Composer } from './composer'
import { MessageList, type PendingChatMessage } from './message-list'
import { initialsOf } from './message-row'
import { useChatRecovery } from './use-chat-stream'

/**
 * The optimistic row and the row the server answers with share exactly one field, and it is the
 * one the sender minted: `clientMsgId`. The id and the `seq` are the server's, so anything else
 * would fail to recognise the message as its own and draw it twice — which is what a person sees
 * when the realtime signal beats the POST's own answer.
 */
export function visiblePending(
  items: readonly ChatMessage[],
  pending: readonly PendingChatMessage[],
): PendingChatMessage[] {
  const landed = new Set(items.map((item) => item.clientMsgId))
  return pending.filter((row) => !landed.has(row.message.clientMsgId))
}

/**
 * The message the NOVO rule goes above: counted back from the newest, over what a person can
 * actually have missed. System rows are skipped because the server never counts them as unread —
 * counting them here would slide the rule past real messages.
 */
export function firstUnreadId(items: readonly ChatMessage[], unreadCount: number): string | null {
  if (unreadCount <= 0) {
    return null
  }

  let remaining = unreadCount
  let id: string | null = null
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item === undefined || item.systemKind !== null) {
      continue
    }
    id = item.id
    remaining -= 1
    if (remaining === 0) {
      break
    }
  }
  return id
}

function appendMessage(page: ChatMessagesPage, message: ChatMessage): ChatMessagesPage {
  if (page.items.some((item) => item.id === message.id)) {
    return page
  }
  return { ...page, items: [...page.items, message] }
}

export interface ConversationPaneProps {
  conversationId: string
  /** What was unread when this conversation was opened — read once, on purpose (see below). */
  unreadCount: number
  authorName: string
  isThread?: boolean
}

/**
 * Reading and writing in one conversation.
 *
 * ⚠ Mount it with `key={conversationId}`: the NOVO rule, the scroll position and anything still
 * being sent all belong to the conversation that is open, and none of them survive a switch.
 */
export function ConversationPane({
  conversationId,
  unreadCount,
  authorName,
  isThread = false,
}: ConversationPaneProps): React.ReactElement {
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(chatMessagesOptions(conversationId))
  const [pending, setPending] = useState<PendingChatMessage[]>([])

  // What the SSE signal cannot promise: everything written while the pipe was down.
  useChatRecovery(conversationId)

  // Frozen at open: marking the conversation read empties `unreadCount` within the second, and a
  // separator that vanished while a person was still reading what it separates is worse than none.
  const [novoBeforeId] = useState(() => firstUnreadId(data.items, unreadCount))

  const send = useMutation({
    mutationFn: (row: PendingChatMessage) =>
      sendChatMessage(conversationId, {
        clientMsgId: row.message.clientMsgId,
        body: row.message.body,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData(chatKeys.messages(conversationId), (page: ChatMessagesPage) =>
        appendMessage(page, created),
      )
      setPending((current) =>
        current.filter((row) => row.message.clientMsgId !== created.clientMsgId),
      )
    },
    onError: (_error, row) => {
      setPending((current) =>
        current.map((item) =>
          item.message.clientMsgId === row.message.clientMsgId ? { ...item, failed: true } : item,
        ),
      )
    },
  })

  const handleSend = (body: string): void => {
    const row: PendingChatMessage = {
      failed: false,
      message: {
        id: crypto.randomUUID(),
        conversationId,
        // No `seq` until the server hands one out — that is what makes this row provisional.
        seq: '',
        clientMsgId: crypto.randomUUID(),
        author: { id: null, name: authorName, initials: initialsOf(authorName) },
        body,
        quoteOf: null,
        systemKind: null,
        systemMeta: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        reactionCount: 0,
        reactedByMe: false,
      },
    }
    setPending((current) => [...current, row])
    send.mutate(row)
  }

  const handleRetry = (clientMsgId: string): void => {
    const row = pending.find((item) => item.message.clientMsgId === clientMsgId)
    if (row === undefined) {
      return
    }
    // The SAME id: the server's unique index on (author, clientMsgId) is what turns a retry into
    // a re-read instead of a second message.
    setPending((current) =>
      current.map((item) =>
        item.message.clientMsgId === clientMsgId ? { ...item, failed: false } : item,
      ),
    )
    send.mutate({ ...row, failed: false })
  }

  const newestSeq = data.items.at(-1)?.seq ?? null
  const lastReadAtRef = useRef(0)
  useEffect(() => {
    if (newestSeq === null) {
      return
    }
    // Throttled, not debounced: entering a conversation reports at once, and a burst of arrivals
    // after that costs one write per five seconds rather than one per message.
    const wait = Math.max(0, CHAT_READ_THROTTLE_MS - (Date.now() - lastReadAtRef.current))
    const timer = setTimeout(() => {
      lastReadAtRef.current = Date.now()
      void markChatRead(conversationId, newestSeq)
        .then(() => queryClient.invalidateQueries({ queryKey: chatKeys.conversations() }))
        // A receipt is not a state change. A lost one is carried by the next, and the server's
        // GREATEST makes a late repeat harmless — so this must not become a red screen.
        .catch(() => undefined)
    }, wait)

    return () => clearTimeout(timer)
  }, [conversationId, newestSeq, queryClient])

  return (
    <>
      <MessageList
        messages={data.items}
        pending={visiblePending(data.items, pending)}
        novoBeforeId={novoBeforeId}
        onRetry={handleRetry}
      />
      <Composer isThread={isThread} onSend={handleSend} />
    </>
  )
}
