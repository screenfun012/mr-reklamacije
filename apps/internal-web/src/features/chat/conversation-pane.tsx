import { m } from '@mr/i18n'
import {
  CHAT_PINS_MAX,
  CHAT_READ_THROTTLE_MS,
  chatKeys,
  MENTION_EVERYONE_ID,
  uniqueMentions,
  chatMessagesOptions,
  chatPinsOptions,
  markChatRead,
  pinChatMessage,
  reactToChatMessage,
  sendChatMessage,
  type ChatMessage,
  type ChatMessagesPage,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

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

/**
 * Your tick, added or taken back, everywhere the page holds that message.
 *
 * Written as a pure function because it is the whole optimistic update: the count moves by one in
 * the direction `reactedByMe` just went, and nothing else about the row changes. Rolling back is
 * the same call again.
 */
export function toggleReaction(page: ChatMessagesPage, messageId: string): ChatMessagesPage {
  return {
    ...page,
    items: page.items.map((item) =>
      item.id === messageId
        ? {
            ...item,
            reactedByMe: !item.reactedByMe,
            reactionCount: Math.max(0, item.reactionCount + (item.reactedByMe ? -1 : 1)),
          }
        : item,
    ),
  }
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
  /** Whose messages get the ticks — passed in like the name, so the pane needs no router. */
  authorId: string
  /** Whether this person may take down somebody else's pin. Passed in for the same reason. */
  isAdmin?: boolean
  /** The claim is decided: the words stay readable and no new ones are taken. */
  isLocked?: boolean | undefined
  isThread?: boolean
  /** What happens when somebody clicks an MR number written in a message. */
  onOpenClaim?: ((target: MrRegistryExistingClaim) => void) | undefined
  /** Where the composer's offer lands. Absent on the claim detail's tab — nowhere else to go. */
  onOpenConversation?: ((conversationId: string) => void) | undefined
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
  authorId,
  isAdmin = false,
  isLocked = false,
  isThread = false,
  onOpenClaim,
  onOpenConversation,
}: ConversationPaneProps): React.ReactElement {
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(chatMessagesOptions(conversationId))
  const [pending, setPending] = useState<PendingChatMessage[]>([])
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)

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
        // The answered message travels as its id; the block beside it was drawn from what the
        // server sent, and the server resolves it again for everybody else.
        ...(row.message.quote === null ? {} : { quoteOf: row.message.quote.id }),
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

  // What is pinned in this room. `useQuery`, not suspense, on purpose: a shortlist that is slow
  // to arrive must never hold up the conversation it belongs to.
  const pins = useQuery(chatPinsOptions(conversationId))
  const pinnedIds = new Set((pins.data?.items ?? []).map((pin) => pin.id))
  const unpinnableIds = new Set(
    (pins.data?.items ?? [])
      .filter((pin) => isAdmin || pin.pinnedBy === authorId)
      .map((pin) => pin.id),
  )

  /**
   * The tick. Optimistic and rolled back by calling the same toggle again — the one thing this
   * mutation does is reversible by repeating it, so there is no snapshot to keep.
   */
  const react = useMutation({
    mutationFn: (message: ChatMessage) => reactToChatMessage(message.id, !message.reactedByMe),
    onMutate: (message) => {
      queryClient.setQueryData(chatKeys.messages(conversationId), (page: ChatMessagesPage) =>
        toggleReaction(page, message.id),
      )
    },
    onError: (_error, message) => {
      queryClient.setQueryData(chatKeys.messages(conversationId), (page: ChatMessagesPage) =>
        toggleReaction(page, message.id),
      )
    },
  })

  /**
   * The pin. NOT optimistic: the shortlist row carries the author and the first words, which this
   * screen would have to reassemble to guess at, and a pin is a deliberate act nobody types twenty
   * of in a row. It waits for the answer and re-reads.
   */
  const pin = useMutation({
    mutationFn: (message: ChatMessage) => pinChatMessage(message.id, !pinnedIds.has(message.id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.pins(conversationId) }),
    // The cap is the only refusal a person can walk into (20 per room), and it must say so rather
    // than look like nothing happened.
    onError: () => showInternalToast(m.chat_pins_full({ count: CHAT_PINS_MAX })),
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
        // ⚠ My own id, not null: the ticks key on it, and a row that claims no author is
        // nobody's — it would sit there without the one tick that says it is going.
        author: { id: authorId, name: authorName, initials: initialsOf(authorName) },
        // Read straight off what was just typed, so the chip is there from the first paint. The
        // server's own row replaces this one a moment later with the name the database holds —
        // which is the same name, unless somebody was renamed between typing and sending.
        // ⚠ `uniqueMentions`, the SAME rule the server applies: the wire promises each person
        // once, and a row that names somebody twice renders two chips under one key.
        mentions: uniqueMentions(body).map((mention) => ({
          id: mention.id,
          name: mention.id === MENTION_EVERYONE_ID ? '' : mention.label,
        })),
        body,
        quote:
          replyTo === null
            ? null
            : {
                id: replyTo.id,
                authorName: replyTo.author?.name ?? '',
                excerpt: replyTo.body,
                isDeleted: false,
              },
        systemKind: null,
        systemMeta: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        seenByAll: false,
        reactionCount: 0,
        reactedByMe: false,
      },
    }
    setPending((current) => [...current, row])
    setReplyTo(null)
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
        onOpenClaim={onOpenClaim}
        onReply={setReplyTo}
        onReact={(message) => react.mutate(message)}
        onPin={(message) => pin.mutate(message)}
        pinnedIds={pinnedIds}
        unpinnableIds={unpinnableIds}
        currentUserId={authorId}
      />
      {isLocked ? (
        <p className="flex-none border-t border-mri-border bg-mri-surface px-4 py-3 text-[12px] text-mri-text2">
          {m.chat_thread_locked()}
        </p>
      ) : (
        <Composer
          isThread={isThread}
          onSend={handleSend}
          conversationId={conversationId}
          onOpened={onOpenConversation}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      )}
    </>
  )
}
