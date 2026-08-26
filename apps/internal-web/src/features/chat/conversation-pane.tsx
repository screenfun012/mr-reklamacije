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
  ApiError,
  buildChatAttachmentUrl,
  sendChatMessage,
  type ChatMessage,
  type ChatMessagesPage,
  type ChatReactor,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { AttachmentPreviewDialog } from '@mr/ui'

import { showInternalToast } from '~/lib/internal-toast'

import { Composer } from './composer'
import { PinnedBar } from './pin-list'
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
 * Your like, added or taken back, everywhere the page holds that message.
 *
 * Written as a pure function because it is the whole optimistic update: your name joins the list
 * or leaves it, and nothing else about the row changes. Rolling back is the same call again.
 */
export function toggleReaction(
  page: ChatMessagesPage,
  messageId: string,
  me: ChatReactor,
): ChatMessagesPage {
  return {
    ...page,
    items: page.items.map((item) => {
      if (item.id !== messageId) {
        return item
      }
      const mine = item.reactedBy.some((person) => person.id === me.id)
      return {
        ...item,
        reactedBy: mine
          ? item.reactedBy.filter((person) => person.id !== me.id)
          : [...item.reactedBy, me],
      }
    }),
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
  /** Direct claim-detail destination when a just-created thread closes before it can open. */
  onOpenClosedClaim?: ((target: MrRegistryExistingClaim) => void) | undefined
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
  onOpenClosedClaim,
  onOpenConversation,
}: ConversationPaneProps): React.ReactElement {
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(chatMessagesOptions(conversationId))
  const [pending, setPending] = useState<PendingChatMessage[]>([])
  /** The photo being looked at full size, and the message it belongs to. */
  const [preview, setPreview] = useState<{ message: ChatMessage; attachmentId: string } | null>(
    null,
  )
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)

  // What the SSE signal cannot promise: everything written while the pipe was down.
  useChatRecovery(conversationId)

  // Frozen at open: marking the conversation read empties `unreadCount` within the second, and a
  // separator that vanished while a person was still reading what it separates is worse than none.
  const [novoBeforeId] = useState(() => firstUnreadId(data.items, unreadCount))

  const send = useMutation({
    mutationFn: (row: PendingChatMessage) =>
      sendChatMessage(
        conversationId,
        {
          clientMsgId: row.message.clientMsgId,
          body: row.message.body,
          // The answered message travels as its id; the block beside it was drawn from what the
          // server sent, and the server resolves it again for everybody else.
          ...(row.message.quote === null ? {} : { quoteOf: row.message.quote.id }),
        },
        row.files,
      ),
    onSuccess: (created, row) => {
      queryClient.setQueryData(chatKeys.messages(conversationId), (page: ChatMessagesPage) =>
        appendMessage(page, created),
      )
      setPending((current) =>
        current.filter((row) => row.message.clientMsgId !== created.clientMsgId),
      )

      /**
       * The words landed and some of the files did not.
       *
       * ⚠ Said out loud, because otherwise a 201 with two of three photos looks exactly like a
       * 201 with three. And sending them again has to be a NEW message: the same clientMsgId
       * would answer 200 and drop the bytes, which is how a photo becomes unrecoverable.
       */
      if (row.files.length > 0) {
        // The shelf in the panel is its own request — the message landing in the cache says
        // nothing to it.
        void queryClient.invalidateQueries({
          queryKey: chatKeys.attachments(conversationId),
        })
      }

      if (created.partialFiles > 0) {
        showInternalToast(m.chat_attachment_partial())
      }
    },
    onError: (error, row) => {
      /*
       * The server's own sentence, not a generic "not sent".
       *
       * ⚠ And a 4xx is a REFUSAL, not a hiccup: the same bytes under the same clientMsgId can only
       * be refused again, so offering "try again" for one is a button that cannot work. The intake
       * quote reached the same conclusion — "file too large" and "unsupported type" are things the
       * office can act on, and only if it is told.
       */
      const refused = error instanceof ApiError && error.status >= 400 && error.status < 500
      if (error instanceof ApiError) {
        showInternalToast(error.message)
      }

      if (refused) {
        setPending((current) =>
          current.filter((item) => item.message.clientMsgId !== row.message.clientMsgId),
        )
        return
      }

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
   * The like. Optimistic and rolled back by calling the same toggle again — the one thing this
   * mutation does is reversible by repeating it, so there is no snapshot to keep.
   */
  const me: ChatReactor = { id: authorId, name: authorName }
  const react = useMutation({
    mutationFn: (message: ChatMessage) =>
      reactToChatMessage(message.id, !message.reactedBy.some((person) => person.id === authorId)),
    onMutate: (message) => {
      queryClient.setQueryData(chatKeys.messages(conversationId), (page: ChatMessagesPage) =>
        toggleReaction(page, message.id, me),
      )
    },
    onError: (_error, message) => {
      queryClient.setQueryData(chatKeys.messages(conversationId), (page: ChatMessagesPage) =>
        toggleReaction(page, message.id, me),
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

  const handleSend = (body: string, files: readonly File[]): void => {
    const row: PendingChatMessage = {
      failed: false,
      files,
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
                hasAttachment: replyTo.attachments.length > 0,
              },
        systemKind: null,
        systemMeta: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        seenByAll: false,
        reactedBy: [],
        // The local preview of files still in flight lands here in the next step; an optimistic
        // row carries none of its own yet — the previews are drawn from `files` above.
        attachments: [],
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

  /**
   * A chat file has no `caption` column of its own, so the dialog's optional one is always null —
   * declared here rather than widened in the dialog, which every other caller does use.
   */
  const previewImages = (preview?.message.attachments ?? [])
    .filter((file) => file.mimeType.startsWith('image/'))
    .map((file) => ({ ...file, caption: null }))
  const previewAttachment = previewImages.find((file) => file.id === preview?.attachmentId) ?? null

  return (
    <>
      {/* Above the messages, not behind a button: a pin exists so nobody has to go looking. */}
      <PinnedBar
        conversationId={conversationId}
        currentUserId={authorId}
        isAdmin={isAdmin}
        isLocked={isLocked}
      />
      <MessageList
        messages={data.items}
        pending={isLocked ? [] : visiblePending(data.items, pending)}
        novoBeforeId={novoBeforeId}
        onRetry={handleRetry}
        onOpenImage={(message, attachmentId) => setPreview({ message, attachmentId })}
        onOpenClaim={onOpenClaim}
        onReply={isLocked ? undefined : setReplyTo}
        onReact={isLocked ? undefined : (message) => react.mutate(message)}
        onPin={isLocked ? undefined : (message) => pin.mutate(message)}
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
          onClosed={onOpenClosedClaim}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      )}

      <AttachmentPreviewDialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null)
          }
        }}
        attachment={previewAttachment}
        // Paging stays INSIDE the message the photo belongs to. Walking the whole room would need
        // its own endpoint — the browser holds one page of fifty messages, no more.
        imageAttachments={previewImages}
        onNavigate={(next) =>
          setPreview((current) => (current === null ? null : { ...current, attachmentId: next.id }))
        }
        // ⚠ The chat's own route, never `/api/attachments`: that one is gated by a permission
        // which opens every claim's files, and the chat admits people who hold none of it.
        buildUrl={(id, disposition) =>
          buildChatAttachmentUrl(
            conversationId,
            id,
            disposition === 'attachment' ? { disposition: 'attachment' } : {},
          )
        }
      />
    </>
  )
}
