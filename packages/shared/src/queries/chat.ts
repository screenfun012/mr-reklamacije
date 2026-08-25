import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { fetchNoContent } from '../api/fetch-no-content.js'
import { fetchParsed } from '../api/fetch-json.js'
import type { ClaimKind } from '../enums.js'
import {
  ChatConversationListItemSchema,
  ChatChannelManagementListResponseSchema,
  ChatChannelManagementQuerySchema,
  ChatClaimThreadLookupSchema,
  ChatConversationListResponseSchema,
  ChatSendResponseSchema,
  ChatMessagesPageSchema,
  ChatPeopleResponseSchema,
  ChatMembersResponseSchema,
  ChatConversationAttachmentsResponseSchema,
  ChatPinsResponseSchema,
  type ChatConversationListItem,
  type ChatChannelCreateInput,
  type ChatChannelManagementQuery,
  type ChatClaimThreadLookup,
  type ChatSendResponse,
  type ChatMessagesPage,
  type ChatConversationAttachmentsResponse,
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
  attachments: (conversationId: string) =>
    [...chatKeys.all, 'attachments', conversationId] as const,
  members: (conversationId: string) => [...chatKeys.all, 'members', conversationId] as const,
  claimThreads: () => [...chatKeys.all, 'claim-threads'] as const,
  claimThread: (kind: ClaimKind, claimId: string) =>
    [...chatKeys.claimThreads(), kind, claimId] as const,
  channelManagement: () => [...chatKeys.all, 'channel-management'] as const,
  channelManagementList: (query: ChatChannelManagementQuery) =>
    [...chatKeys.channelManagement(), 'list', query] as const,
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
 * Where a chat file is served from.
 *
 * ⚠ Through the CHAT's own route, never `/api/attachments/:id/download`. That one is gated by
 * `attachments.view_internal`, which is the permission that opens every CLAIM's files — and the
 * chat lets in people who hold none of it (a serviser, a statistics-only account). The intake
 * module reached the same conclusion for the same reason.
 */
export function buildChatAttachmentUrl(
  conversationId: string,
  attachmentId: string,
  options: { variant?: 'thumbnail'; disposition?: 'attachment' } = {},
): string {
  const params = new URLSearchParams()
  if (options.variant !== undefined) {
    params.set('variant', options.variant)
  }
  if (options.disposition !== undefined) {
    params.set('disposition', options.disposition)
  }
  const query = params.size === 0 ? '' : `?${params.toString()}`
  return `/api/chat/conversations/${conversationId}/attachments/${attachmentId}${query}`
}

export function chatMembersOptions(conversationId: string) {
  return queryOptions({
    queryKey: chatKeys.members(conversationId),
    queryFn: () =>
      fetchParsed(`/api/chat/conversations/${conversationId}/members`, ChatMembersResponseSchema),
  })
}

export function chatClaimThreadOptions(kind: ClaimKind, claimId: string) {
  return queryOptions({
    queryKey: chatKeys.claimThread(kind, claimId),
    queryFn: () =>
      fetchParsed(`/api/chat/claims/${kind}/${claimId}/thread`, ChatClaimThreadLookupSchema),
  })
}

export function chatChannelManagementOptions(query: ChatChannelManagementQuery) {
  const normalizedQuery = ChatChannelManagementQuerySchema.parse(query)
  const params = new URLSearchParams()
  if (normalizedQuery.search !== undefined) {
    params.set('search', normalizedQuery.search)
  }
  params.set('page', String(normalizedQuery.page))
  params.set('pageSize', String(normalizedQuery.pageSize))

  return queryOptions({
    queryKey: chatKeys.channelManagementList(normalizedQuery),
    queryFn: () =>
      fetchParsed(
        `/api/chat/channels?${params.toString()}`,
        ChatChannelManagementListResponseSchema,
      ),
  })
}

export function createChatChannel(
  input: ChatChannelCreateInput,
): Promise<ChatConversationListItem> {
  return fetchParsed('/api/chat/channels', ChatConversationListItemSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function renameChatChannel(conversationId: string, name: string): Promise<void> {
  return fetchNoContent(`/api/chat/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function invalidateChatConversationMetadataQueries(
  queryClient: QueryClient,
  conversationId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
  void queryClient.invalidateQueries({ queryKey: chatKeys.members(conversationId) })
  void queryClient.invalidateQueries({ queryKey: chatKeys.people(conversationId) })
  void queryClient.invalidateQueries({ queryKey: chatKeys.channelManagement() })
  for (const [queryKey, lookup] of queryClient.getQueriesData<ChatClaimThreadLookup>({
    queryKey: chatKeys.claimThreads(),
  })) {
    if (lookup?.conversation?.id === conversationId) {
      void queryClient.invalidateQueries({ queryKey, exact: true })
    }
  }
}

export function addChatMembers(conversationId: string, userIds: readonly string[]): Promise<void> {
  return fetchNoContent(`/api/chat/conversations/${conversationId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds }),
  })
}

/** `me` is how somebody walks out without needing to know their own id. */
export function removeChatMember(conversationId: string, userId: string | 'me'): Promise<void> {
  return fetchNoContent(`/api/chat/conversations/${conversationId}/members/${userId}`, {
    method: 'DELETE',
  })
}

/**
 * Sends one message. The server answers 201 with the new row and 200 with the row a retry of
 * the same `clientMsgId` already created — both are the same shape, so the caller replaces its
 * optimistic row either way and a retry can never post twice.
 */
export function sendChatMessage(
  conversationId: string,
  input: ChatSendInput,
  files: readonly File[] = [],
): Promise<ChatSendResponse> {
  const url = `/api/chat/conversations/${conversationId}/messages`

  // Words alone stay JSON. The moment a file rides along the whole message goes multipart —
  // ⚠ one request, not upload-then-send: the clientMsgId that makes a retried message land
  // exactly once has to cover its photos too, or a retry stores a second copy of each.
  if (files.length === 0) {
    return fetchParsed(url, ChatSendResponseSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  }

  const form = new FormData()
  form.set('clientMsgId', input.clientMsgId)
  form.set('body', input.body)
  if (input.quoteOf !== undefined) {
    form.set('quoteOf', input.quoteOf)
  }
  for (const file of files) {
    form.append('files', file)
  }

  // ⚠ No Content-Type of our own: the browser has to write the multipart boundary itself.
  return fetchParsed(url, ChatSendResponseSchema, { method: 'POST', body: form })
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
/**
 * The room's shelf of files.
 *
 * ⚠ Its own request rather than a filter over the messages already in the cache: that cache holds
 * one page of fifty, so in an older room both the nine shown and the total would be wrong — and
 * wrong without anything looking wrong.
 */
export function chatConversationAttachmentsOptions(conversationId: string) {
  return queryOptions({
    queryKey: chatKeys.attachments(conversationId),
    queryFn: () =>
      fetchParsed<ChatConversationAttachmentsResponse>(
        `/api/chat/conversations/${conversationId}/attachments`,
        ChatConversationAttachmentsResponseSchema,
      ),
  })
}

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
