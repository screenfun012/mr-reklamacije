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

/**
 * One person named in a message. The id is what was stored; the name is read at read time, so a
 * renamed account does not leave old sentences talking about somebody who no longer exists under
 * that name (spec §5 row 7).
 *
 * `@svi` arrives as the reserved id with an EMPTY name — the server does not write Serbian, the
 * screen names it. (Same rule the statistics buckets follow.)
 */
export const ChatMentionSchema = z.object({
  id: z.string(),
  /**
   * `null` when the server has no name to give, and it means one of two things the screen tells
   * apart by the id: `@svi`, which the screen names itself because the server does not write
   * Serbian; or an id with no LIVE account behind it — a colleague who has left, or an address
   * somebody typed by hand. The second is why this is nullable at all: a chip that looks like a
   * link to a real person, pointing at nobody, is a forgery in a conversation that is evidence
   * for a claim. Those are drawn as words instead.
   */
  name: z.string().nullable(),
})

export type ChatMention = z.infer<typeof ChatMentionSchema>

/**
 * The message being answered, as much of it as the block on screen draws.
 *
 * ⚠ The id alone is not enough and cannot be made enough on the client: the quoted message may sit
 * on an older page the browser never loaded, so it has nothing to look the author or the words up
 * in. The server resolves it — once per page, not once per message.
 */
export const ChatQuoteSchema = z.object({
  id: z.string().uuid(),
  authorName: z.string(),
  /** The first words, already stripped of mention markup. Empty when the message was taken back. */
  excerpt: z.string(),
  /** The quoted message was withdrawn: the block says so rather than repeating words that no
   * longer travel anywhere else. */
  isDeleted: z.boolean(),
})

export type ChatQuote = z.infer<typeof ChatQuoteSchema>

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  seq: SeqSchema,
  /** Echoed back so an optimistic row can be replaced by the real one it became. */
  clientMsgId: z.string().uuid(),
  author: ChatMessageAuthorSchema.nullable(),
  /** Empty for a deleted message — the row stays, the words do not travel. */
  body: z.string(),
  quote: ChatQuoteSchema.nullable(),
  /** Everybody this message names, in writing order, each of them once. */
  mentions: z.array(ChatMentionSchema),
  systemKind: z.enum(chatSystemKindValues).nullable(),
  systemMeta: z.record(z.string(), z.string()).nullable(),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  /**
   * Everybody who can see this conversation has got at least this far — the two coloured ticks.
   *
   * ⚠ "Got this far", not "read it": the marker moves when a person has the conversation open,
   * which is exactly as much as WhatsApp's blue ticks ever meant. The author is never waited on.
   */
  seenByAll: z.boolean(),
  reactionCount: z.number().int().nonnegative(),
  reactedByMe: z.boolean(),
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

/**
 * Somebody a mention in this conversation may name. Nothing beyond what one row of a menu draws —
 * a chat picker is not a user directory, and this endpoint is reachable by every internal account.
 */
export const ChatPersonSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  initials: z.string(),
})

export type ChatPerson = z.infer<typeof ChatPersonSchema>

export const ChatPeopleResponseSchema = z.object({ items: z.array(ChatPersonSchema) })

export type ChatPeopleResponse = z.infer<typeof ChatPeopleResponseSchema>

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
  /**
   * The claim this thread belongs to has been decided, so the room is closed: it is off the list
   * and takes no more words. Read from the claim's outcome rather than stored — a column would be
   * one more thing that can be wrong, and reopening the claim reopens the room by itself.
   */
  isLocked: z.boolean(),
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
