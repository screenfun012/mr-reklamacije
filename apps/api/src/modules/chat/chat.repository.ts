import { ChatConversationType, ClaimKind, getInitials, type ChatSystemKind } from '@mr/shared'
import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import {
  chatConversations,
  chatMembers,
  chatMessages,
  chatMutes,
  chatReactions,
  customers,
  domaceClaims,
  emotiveClaims,
  users,
} from './chat.schema.js'
import type {
  ChatConversationListItem,
  ChatMessage,
  ChatMessagesPage,
  ChatMessagesQuery,
} from './chat.validators.js'

/**
 * What this actor is allowed to see, resolved ONCE from his permissions and then carried into
 * every read. The two claim flags are the whole security of the module — see the service.
 */
export interface ChatVisibilityScope {
  userId: string
  canReadEmotiveClaims: boolean
  canReadDomaceClaims: boolean
}

interface ConversationRow {
  id: string
  type: string
  name: string | null
  emotiveClaimId: string | null
  domaceClaimId: string | null
  emotiveMrNumber: string | null
  emotiveCustomerName: string | null
  domaceMrNumber: string | null
  domaceClaimNumber: string | null
  domaceCustomerName: string | null
  isMuted: boolean
  lastMessageAt: string | null
}

/** What a person's message is made of. A system message is written by the port, not from here. */
export interface ChatMessageInsert {
  conversationId: string
  authorId: string
  clientMsgId: string
  body: string
  quoteOf: string | null
}

interface MessageRow {
  id: string
  conversationId: string
  seq: bigint
  clientMsgId: string
  authorId: string | null
  authorName: string | null
  authorEmail: string | null
  body: string
  quoteOf: string | null
  systemKind: string | null
  systemMeta: Record<string, string> | null
  editedAt: Date | null
  deletedAt: Date | null
  createdAt: Date
  reactionCount: number
  reactedByMe: boolean
}

/**
 * The visible set, in one place, used by BOTH reads — the list and a page of messages.
 *
 * The general channel is everyone's; a channel is its members'; a claim thread belongs to whoever
 * may read that claim WITH THE INTERNAL SETS. ⚠ Never `*_view_own_customer`: that is what a portal
 * client holds, and reading it here would walk him into the shop's internal conversations (the
 * same hole that was closed on 2026-08-21 and is written down in CLAUDE.md §2).
 *
 * A soft-deleted claim takes its thread off the list with it, and gives it back on restore.
 */
function visibleConversationCondition(scope: ChatVisibilityScope): SQL {
  const emotiveThread = scope.canReadEmotiveClaims
    ? sql`(${emotiveClaims.id} IS NOT NULL AND ${emotiveClaims.deletedAt} IS NULL)`
    : sql`false`
  const domaceThread = scope.canReadDomaceClaims
    ? sql`(${domaceClaims.id} IS NOT NULL AND ${domaceClaims.deletedAt} IS NULL)`
    : sql`false`

  return sql`(
    ${chatConversations.type} = ${ChatConversationType.General}
    OR (${chatConversations.type} = ${ChatConversationType.Channel} AND EXISTS (
      SELECT 1 FROM ${chatMembers}
      WHERE ${chatMembers.conversationId} = ${chatConversations.id}
        AND ${chatMembers.userId} = ${scope.userId}
    ))
    OR (${chatConversations.type} = ${ChatConversationType.Claim}
        AND (${emotiveThread} OR ${domaceThread}))
  )`
}

/**
 * Postgres hands this back as text, not a Date: drizzle installs its own timestamp type parsers so
 * that its column mappers can do the parsing, and a raw `sql` fragment has no column to map with.
 */
const lastMessageAtSql = sql<string | null>`(
  SELECT MAX(${chatMessages.createdAt}) FROM ${chatMessages}
  WHERE ${chatMessages.conversationId} = ${chatConversations.id}
)`

function mapConversationRow(row: ConversationRow): ChatConversationListItem {
  const isClaimThread = row.type === ChatConversationType.Claim
  const title = isClaimThread
    ? (row.emotiveMrNumber ?? row.domaceMrNumber ?? row.domaceClaimNumber ?? '')
    : (row.name ?? '')

  return {
    id: row.id,
    type: row.type as ChatConversationType,
    title,
    subtitle: isClaimThread ? (row.emotiveCustomerName ?? row.domaceCustomerName ?? '') : '',
    claimKind:
      row.emotiveClaimId !== null
        ? ClaimKind.Emotive
        : row.domaceClaimId !== null
          ? ClaimKind.Domace
          : null,
    claimId: row.emotiveClaimId ?? row.domaceClaimId,
    // Task 5 computes this from `chat_reads`; until then nothing has been read and nothing counts.
    unreadCount: 0,
    isMuted: row.isMuted,
    lastMessageAt: row.lastMessageAt === null ? null : new Date(row.lastMessageAt).toISOString(),
  }
}

function mapMessageRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversationId,
    seq: String(row.seq),
    clientMsgId: row.clientMsgId,
    author:
      row.authorId === null
        ? null
        : {
            id: row.authorId,
            name: row.authorName ?? '',
            initials: getInitials(row.authorName ?? '', row.authorEmail ?? ''),
          },
    // The row stays so the screen can say a message was here; the words do not travel (spec §5.5).
    body: row.deletedAt === null ? row.body : '',
    quoteOf: row.quoteOf,
    systemKind: row.systemKind as ChatSystemKind | null,
    systemMeta: row.systemMeta,
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    reactionCount: row.reactionCount,
    reactedByMe: row.reactedByMe,
  }
}

export class ChatRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listConversations(scope: ChatVisibilityScope): Promise<ChatConversationListItem[]> {
    const rows = await this.conversationSelect(scope)
      .where(and(isNull(chatConversations.deletedAt), visibleConversationCondition(scope)))
      // The general channel is home, then whatever spoke last.
      .orderBy(
        sql`(${chatConversations.type} = ${ChatConversationType.General}) DESC`,
        sql`${lastMessageAtSql} DESC NULLS LAST`,
        desc(chatConversations.createdAt),
      )

    return rows.map(mapConversationRow)
  }

  async findVisibleConversation(
    id: string,
    scope: ChatVisibilityScope,
  ): Promise<ChatConversationListItem | null> {
    const [row] = await this.conversationSelect(scope)
      .where(
        and(
          eq(chatConversations.id, id),
          isNull(chatConversations.deletedAt),
          visibleConversationCondition(scope),
        ),
      )
      .limit(1)

    return row === undefined ? null : mapConversationRow(row)
  }

  /**
   * One page of history, keyset by `seq` — never an offset. Rows come back oldest-first whichever
   * way the page was asked for, because that is the one order the screen draws them in.
   */
  async listMessages(
    conversationId: string,
    query: ChatMessagesQuery,
    userId: string,
  ): Promise<ChatMessagesPage> {
    const conditions: SQL[] = [eq(chatMessages.conversationId, conversationId)]
    if (query.afterSeq !== undefined) {
      conditions.push(sql`${chatMessages.seq} > ${query.afterSeq.toString()}::bigint`)
    }
    if (query.beforeSeq !== undefined) {
      conditions.push(sql`${chatMessages.seq} < ${query.beforeSeq.toString()}::bigint`)
    }

    // Forward reads the window after a point; everything else — including the first open — wants
    // the NEWEST messages, so it reads backwards and is turned around below.
    const forward = query.afterSeq !== undefined

    const rows = await this.messageSelect(userId)
      .where(and(...conditions))
      .orderBy(forward ? asc(chatMessages.seq) : desc(chatMessages.seq))
      .limit(query.limit + 1)

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const items = (forward ? page : [...page].reverse()).map(mapMessageRow)
    const edge = forward ? items.at(-1) : items.at(0)

    return {
      items,
      nextCursor: hasMore ? (edge?.seq ?? null) : null,
      hasMore,
    }
  }

  /**
   * Stores a message, or discovers it was already stored. `ON CONFLICT DO NOTHING` on
   * `(author_id, client_msg_id)` is what makes a retried POST from a flaky tablet safe: the
   * second attempt writes nothing, the empty return says so, and the first message is read back
   * by the same key. Returns `null` only if that key then finds nothing — which the unique index
   * makes impossible, so the service treats it as a conflict rather than inventing a message.
   */
  async insertMessage(input: ChatMessageInsert): Promise<{ id: string; created: boolean } | null> {
    const [inserted] = await this.db
      .insert(chatMessages)
      .values(input)
      .onConflictDoNothing({
        target: [chatMessages.authorId, chatMessages.clientMsgId],
        // The index is PARTIAL, so Postgres only infers it when the predicate is repeated.
        where: sql`${chatMessages.authorId} IS NOT NULL`,
      })
      .returning({ id: chatMessages.id })

    if (inserted !== undefined) {
      return { id: inserted.id, created: true }
    }

    const [existing] = await this.db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.authorId, input.authorId),
          eq(chatMessages.clientMsgId, input.clientMsgId),
        ),
      )
      .limit(1)

    return existing === undefined ? null : { id: existing.id, created: false }
  }

  async findMessageById(id: string, userId: string): Promise<ChatMessage | null> {
    const [row] = await this.messageSelect(userId).where(eq(chatMessages.id, id)).limit(1)
    return row === undefined ? null : mapMessageRow(row)
  }

  /** One shape for a message, wherever it is read from — a page, or the one just written. */
  private messageSelect(userId: string) {
    return this.db
      .select({
        id: chatMessages.id,
        conversationId: chatMessages.conversationId,
        seq: chatMessages.seq,
        clientMsgId: chatMessages.clientMsgId,
        authorId: chatMessages.authorId,
        authorName: users.name,
        authorEmail: users.email,
        body: chatMessages.body,
        quoteOf: chatMessages.quoteOf,
        systemKind: chatMessages.systemKind,
        systemMeta: chatMessages.systemMeta,
        editedAt: chatMessages.editedAt,
        deletedAt: chatMessages.deletedAt,
        createdAt: chatMessages.createdAt,
        reactionCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${chatReactions}
          WHERE ${chatReactions.messageId} = ${chatMessages.id}
        )`.mapWith(Number),
        reactedByMe: sql<boolean>`EXISTS (
          SELECT 1 FROM ${chatReactions}
          WHERE ${chatReactions.messageId} = ${chatMessages.id}
            AND ${chatReactions.userId} = ${userId}
        )`,
      })
      .from(chatMessages)
      .leftJoin(users, eq(users.id, chatMessages.authorId))
  }

  private conversationSelect(scope: ChatVisibilityScope) {
    return this.db
      .select({
        id: chatConversations.id,
        type: chatConversations.type,
        name: chatConversations.name,
        emotiveClaimId: chatConversations.emotiveClaimId,
        domaceClaimId: chatConversations.domaceClaimId,
        emotiveMrNumber: emotiveClaims.mrNumber,
        emotiveCustomerName: customers.name,
        domaceMrNumber: domaceClaims.mrNumber,
        domaceClaimNumber: domaceClaims.claimNumber,
        domaceCustomerName: domaceClaims.customerName,
        isMuted: sql<boolean>`EXISTS (
          SELECT 1 FROM ${chatMutes}
          WHERE ${chatMutes.conversationId} = ${chatConversations.id}
            AND ${chatMutes.userId} = ${scope.userId}
        )`,
        lastMessageAt: lastMessageAtSql,
      })
      .from(chatConversations)
      .leftJoin(emotiveClaims, eq(emotiveClaims.id, chatConversations.emotiveClaimId))
      .leftJoin(domaceClaims, eq(domaceClaims.id, chatConversations.domaceClaimId))
      .leftJoin(customers, eq(customers.id, emotiveClaims.customerId))
  }
}
