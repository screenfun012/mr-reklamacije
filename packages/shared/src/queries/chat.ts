import { queryOptions } from '@tanstack/react-query'

import { fetchNoContent } from '../api/fetch-no-content.js'
import { fetchParsed } from '../api/fetch-json.js'
import type { ClaimKind } from '../enums.js'
import {
  ChatConversationListItemSchema,
  ChatConversationListResponseSchema,
  ChatMessageSchema,
  ChatMessagesPageSchema,
  ChatPeopleResponseSchema,
  ChatPinsResponseSchema,
  type ChatConversationListItem,
  type ChatMessage,
  type ChatMessagesPage,
  type ChatPin,
  type ChatSendInput,
} from '../schemas/chat.schema.js'

/**
 * The list is refreshed by the SSE signal, not by the clock — this only stops a burst of
 * navigations from asking three times in a second.
 */
const CHAT_CONVERSATIONS_STALE_MS = 15_000
/** The office roster changes when somebody is hired, not while a sentence is being typed. */
const CHAT_PEOPLE_STALE_MS = 5 * 60_000

/**
 * Query keys for the chat.
 *
 * They exist separately from the fetchers because the SSE handler needs something to invalidate
 * the moment the server publishes `chat_message_created`, and a signal nobody acts on is the
 * quiet way a realtime feature ends up not being realtime.
 */
export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
  people: (conversationId: string) => [...chatKeys.all, 'people', conversationId] as const,
  pins: (conversationId: string) => [...chatKeys.all, 'pins', conversationId] as const,
}

/** Every conversation this person may enter, plus the ONE unread number the sidebar shows. */
export function chatConversationsOptions() {
  return queryOptions({
    queryKey: chatKeys.conversations(),
    queryFn: () => fetchParsed('/api/chat/conversations', ChatConversationListResponseSchema),
    staleTime: CHAT_CONVERSATIONS_STALE_MS,
  })
}

/**
 * Erases a room. Admin only, and the server is the judge of that — this is only the doorbell.
 */
export async function deleteChatConversation(conversationId: string): Promise<void> {
  await fetchNoContent(`/api/chat/conversations/${conversationId}`, { method: 'DELETE' })
}

/**
 * Who a mention in this conversation may name — the people who can actually see it.
 *
 * Per conversation, not per app: the general channel is the whole internal office, a claim thread
 * is whoever may read that claim. Fetched once and narrowed in the browser, because the office is
 * a handful of people and a search endpoint for nine rows is a moving part nobody needs.
 */
export function chatPeopleOptions(conversationId: string) {
  return queryOptions({
    queryKey: chatKeys.people(conversationId),
    queryFn: () =>
      fetchParsed(`/api/chat/conversations/${conversationId}/people`, ChatPeopleResponseSchema),
    staleTime: CHAT_PEOPLE_STALE_MS,
  })
}

/**
 * The newest page of a conversation. Older pages are asked for with `beforeSeq` from this
 * page's cursor; this call takes none, so it always means "what is at the bottom right now".
 *
 * ⚠ `staleTime: 0` because a chat is never stale, and `refetchOnWindowFocus: false` because
 * recovery — refetching from `maxSeen - CHAT_RECOVERY_OVERLAP` on reconnect and on the tab
 * becoming visible — is the mechanism that guarantees nothing was missed. Leaving focus-refetch
 * on would double-fetch AND hide a broken recovery behind it, which is the one failure this
 * design cannot afford to make invisible.
 */
export function chatMessagesOptions(conversationId: string) {
  return queryOptions({
    queryKey: chatKeys.messages(conversationId),
    queryFn: () =>
      fetchParsed<ChatMessagesPage>(
        `/api/chat/conversations/${conversationId}/messages`,
        ChatMessagesPageSchema,
      ),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

/**
 * Everything newer than `afterSeq`, for putting back what a sleeping tab missed.
 *
 * ⚠ The caller asks from `maxSeen - CHAT_RECOVERY_OVERLAP`, never from `maxSeen`. `seq` is handed
 * out at INSERT and becomes visible at COMMIT, so a reader can hold 42 while 41 is still being
 * written — and a request for "> 42" would lose 41 for good. The overlap costs twenty rows the
 * caller already has and throws away by id.
 */
export function fetchChatMessagesSince(
  conversationId: string,
  afterSeq: string,
): Promise<ChatMessagesPage> {
  return fetchParsed(
    `/api/chat/conversations/${conversationId}/messages?afterSeq=${afterSeq}`,
    ChatMessagesPageSchema,
  )
}

/**
 * Sends one message. The server answers 201 with the new row and 200 with the row a retry of
 * the same `clientMsgId` already created — both are the same shape, so the caller replaces its
 * optimistic row either way and a retry can never post twice.
 */
export function sendChatMessage(
  conversationId: string,
  input: ChatSendInput,
): Promise<ChatMessage> {
  return fetchParsed(`/api/chat/conversations/${conversationId}/messages`, ChatMessageSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/**
 * Opens a claim's thread — and creates it when there is none.
 *
 * Get-or-create on purpose: "1 claim = 1 thread" is a database constraint, so two people clicking
 * the same MR number at the same second land in the same room. The server answers 201 when it made
 * one (and writes the `thread_created` system message) and 200 when it was already there; both
 * carry the same row, so the caller only has to open what it got back.
 *
 * ⚠ Nothing here decides whether a thread SHOULD be made — the screen asks the person first
 * (spec §8.2: nothing is created silently).
 */
export function openChatClaimThread(
  kind: ClaimKind,
  claimId: string,
): Promise<ChatConversationListItem> {
  return fetchParsed(`/api/chat/claims/${kind}/${claimId}/thread`, ChatConversationListItemSchema, {
    method: 'POST',
  })
}

/**
 * Marks everything up to `lastSeq` read. `seq` is a Postgres bigint and travels as a string —
 * turning it into a JS number here is the one place it could silently lose precision.
 */
export function markChatRead(conversationId: string, lastSeq: string): Promise<void> {
  return fetchNoContent(`/api/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lastSeq }),
  })
}

/**
 * What is pinned in this conversation. At most `CHAT_PINS_MAX` rows, so there is no paging and no
 * stale time worth setting: the list is invalidated by the pin that changed it, and by the same
 * `chat_message_created` signal every other reader gets.
 */
export function chatPinsOptions(conversationId: string) {
  return queryOptions({
    queryKey: chatKeys.pins(conversationId),
    queryFn: () =>
      fetchParsed<{ items: ChatPin[] }>(
        `/api/chat/conversations/${conversationId}/pins`,
        ChatPinsResponseSchema,
      ),
  })
}

/**
 * The tick and the pin, both ways. All four answer 204 — what changed is one row the caller
 * already holds, which is why these are the small actions an optimistic update is allowed for
 * (CLAUDE.md §8 drift note).
 */
export function reactToChatMessage(messageId: string, on: boolean): Promise<void> {
  return fetchNoContent(`/api/chat/messages/${messageId}/reaction`, {
    method: on ? 'POST' : 'DELETE',
  })
}

export function pinChatMessage(messageId: string, on: boolean): Promise<void> {
  return fetchNoContent(`/api/chat/messages/${messageId}/pin`, { method: on ? 'POST' : 'DELETE' })
}
