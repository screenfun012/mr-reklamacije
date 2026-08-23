import { z } from 'zod'

import {
  CHAT_MESSAGES_PAGE_SIZE,
  CHAT_MESSAGE_MAX_LENGTH,
  chatConversationTypeValues,
  chatSystemKindValues,
} from '../constants/chat.js'
import { ClaimKind } from '../enums.js'

/**
 * `seq` crosses the wire as a STRING. It is a Postgres bigint, and JSON has no integer wide
 * enough to promise it back unchanged — the client compares it numerically after `Number()`,
 * which is exact far beyond any number of messages this shop will ever send.
 */
const SeqSchema = z.string().regex(/^\d+$/)

export const ChatMessageAuthorSchema = z.object({
  id: z.string().uuid().nullable(),
  /** The name as it is TODAY — never the name stored at send time, or a rename would rewrite history. */
  name: z.string(),
  initials: z.string(),
})

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  seq: SeqSchema,
  /** Echoed back so an optimistic row can be replaced by the real one it became. */
  clientMsgId: z.string().uuid(),
  author: ChatMessageAuthorSchema.nullable(),
  /** Empty for a deleted message — the row stays, the words do not travel. */
  body: z.string(),
  quoteOf: z.string().uuid().nullable(),
  systemKind: z.enum(chatSystemKindValues).nullable(),
  systemMeta: z.record(z.string(), z.string()).nullable(),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  reactionCount: z.number().int().nonnegative(),
  reactedByMe: z.boolean(),
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

export const ChatConversationListItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(chatConversationTypeValues),
  /** The channel's name, or the thread's MR number — whichever names this row on the screen. */
  title: z.string(),
  /** Partner and engine for a thread, member count for a channel; empty when there is nothing. */
  subtitle: z.string(),
  claimKind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]).nullable(),
  claimId: z.string().uuid().nullable(),
  unreadCount: z.number().int().nonnegative(),
  isMuted: z.boolean(),
  lastMessageAt: z.string().nullable(),
})

export type ChatConversationListItem = z.infer<typeof ChatConversationListItemSchema>

export const ChatConversationListResponseSchema = z.object({
  items: z.array(ChatConversationListItemSchema),
  /** The sum on the sidebar. Muted conversations are deliberately NOT in it. */
  unreadTotal: z.number().int().nonnegative(),
})

export const ChatMessagesPageSchema = z.object({
  items: z.array(ChatMessageSchema),
  /** Feed back into the same cursor to continue; null when the end has been reached. */
  nextCursor: SeqSchema.nullable(),
  hasMore: z.boolean(),
})

export type ChatMessagesPage = z.infer<typeof ChatMessagesPageSchema>

export const ChatMessagesQuerySchema = z
  .object({
    afterSeq: z.coerce.bigint().nonnegative().optional(),
    beforeSeq: z.coerce.bigint().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(CHAT_MESSAGES_PAGE_SIZE),
  })
  .refine((value) => value.afterSeq === undefined || value.beforeSeq === undefined, {
    // A page is either newer or older than a point. Both at once is not a window, it is a bug
    // that would silently return one of the two and look like it worked.
    message: 'afterSeq and beforeSeq are mutually exclusive',
    path: ['beforeSeq'],
  })

export type ChatMessagesQuery = z.infer<typeof ChatMessagesQuerySchema>

export const ChatSendInputSchema = z.object({
  /** Minted by the sender BEFORE the request, so a retry lands exactly once. */
  clientMsgId: z.string().uuid(),
  body: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
  quoteOf: z.string().uuid().optional(),
})

export type ChatSendInput = z.infer<typeof ChatSendInputSchema>

export const ChatEditInputSchema = z.object({
  body: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
})

export const ChatMarkReadInputSchema = z.object({
  lastSeq: z.coerce.bigint().nonnegative(),
})

export const ChatChannelCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  memberIds: z.array(z.string().uuid()).max(200),
})

export type ChatChannelCreateInput = z.infer<typeof ChatChannelCreateInputSchema>
