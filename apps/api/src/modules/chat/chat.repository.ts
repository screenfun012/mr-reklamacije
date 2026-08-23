import { ChatConversationType, ClaimKind, getInitials, type ChatSystemKind } from '@mr/shared'
import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import {
  chatConversations,
  chatMembers,
  chatMessages,
  chatMutes,
  chatPins,
  chatReactions,
  chatReads,
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
  unreadCount: number
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

/**
 * The ONE unread number (spec §3.2): everything after this person's marker in `chat_reads`, and
 * nothing else. No marker yet means nothing has been read, so the count starts from zero.
 *
 * Three exclusions, and the third is deliberate rather than incidental:
 *  - a deleted message has no words left to read;
 *  - my own message is not news to me;
 *  - a SYSTEM message never counts — it is a record, not somebody talking. `author_id` is NULL
 *    there, so `author_id <> me` would already drop it (NULL comparisons are never true), but the
 *    rule is written out because relying on that is how it comes back the day the comparison is
 *    rewritten.
 */
function unreadCountSql(userId: string): SQL<number> {
  return sql<number>`(
    SELECT COUNT(*)::int FROM ${chatMessages}
    WHERE ${chatMessages.conversationId} = ${chatConversations.id}
      AND ${chatMessages.deletedAt} IS NULL
      AND ${chatMessages.authorId} IS NOT NULL
      AND ${chatMessages.authorId} <> ${userId}
      AND ${chatMessages.seq} > COALESCE((
        SELECT ${chatReads.lastSeq} FROM ${chatReads}
        WHERE ${chatReads.conversationId} = ${chatConversations.id}
          AND ${chatReads.userId} = ${userId}
      ), 0)
  )`.mapWith(Number)
}

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
    unreadCount: row.unreadCount,
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

  /** Is there a claim here at all, and is it still alive? A deleted claim gets no thread. */
  async claimExists(kind: ClaimKind, claimId: string): Promise<boolean> {
    const claims = kind === ClaimKind.Emotive ? emotiveClaims : domaceClaims
    const [row] = await this.db
      .select({ id: claims.id })
      .from(claims)
      .where(and(eq(claims.id, claimId), isNull(claims.deletedAt)))
      .limit(1)

    return row !== undefined
  }

  /** The claim's thread, or null. A soft-deleted one does not count — the claim is free again. */
  async findClaimThreadId(kind: ClaimKind, claimId: string): Promise<string | null> {
    const column =
      kind === ClaimKind.Emotive
        ? chatConversations.emotiveClaimId
        : chatConversations.domaceClaimId
    const [row] = await this.db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(and(eq(column, claimId), isNull(chatConversations.deletedAt)))
      .limit(1)

    return row?.id ?? null
  }

  /**
   * Get-or-create, in that order of outcomes but not of statements: it inserts first and lets the
   * partial unique index decide. Two people opening the claim at the same instant both reach this,
   * and `ON CONFLICT DO NOTHING` is what makes the loser read the winner's thread instead of
   * failing — the same shape `insertMessage` uses. No target: the only unique index a `claim` row
   * can collide with is its own claim's.
   */
  async openClaimThread(
    kind: ClaimKind,
    claimId: string,
    createdBy: string,
  ): Promise<{ id: string; created: boolean } | null> {
    const [inserted] = await this.db
      .insert(chatConversations)
      .values({
        type: ChatConversationType.Claim,
        emotiveClaimId: kind === ClaimKind.Emotive ? claimId : null,
        domaceClaimId: kind === ClaimKind.Domace ? claimId : null,
        createdBy,
      })
      .onConflictDoNothing()
      .returning({ id: chatConversations.id })

    if (inserted !== undefined) {
      return { id: inserted.id, created: true }
    }

    const existing = await this.findClaimThreadId(kind, claimId)

    return existing === null ? null : { id: existing, created: false }
  }

  /**
   * What the shop did, written into the thread. No author (it is nobody talking) and no body —
   * the screen draws the sentence from `system_kind` + `system_meta`, so a rename or a
   * translation later does not have to rewrite history.
   */
  async insertSystemMessage(
    conversationId: string,
    systemKind: ChatSystemKind,
    systemMeta: Record<string, string>,
  ): Promise<{ id: string } | null> {
    const [inserted] = await this.db
      .insert(chatMessages)
      .values({
        conversationId,
        clientMsgId: crypto.randomUUID(),
        authorId: null,
        body: '',
        systemKind,
        systemMeta,
      })
      .returning({ id: chatMessages.id })

    return inserted ?? null
  }

  /**
   * ⚠ `GREATEST`, never a plain assignment. Read receipts are throttled and fired from a screen
   * that scrolls, so two of them race routinely — and the late one carries the OLDER seq. A plain
   * `SET last_seq = EXCLUDED.last_seq` would walk the marker backwards and make messages the
   * person has already read light up again as unread.
   */
  async markRead(conversationId: string, userId: string, lastSeq: bigint): Promise<void> {
    await this.db
      .insert(chatReads)
      .values({ conversationId, userId, lastSeq })
      .onConflictDoUpdate({
        target: [chatReads.conversationId, chatReads.userId],
        set: {
          lastSeq: sql`GREATEST(${chatReads.lastSeq}, excluded.last_seq)`,
          updatedAt: new Date(),
        },
      })
  }

  async findMessageById(id: string, userId: string): Promise<ChatMessage | null> {
    const [row] = await this.messageSelect(userId).where(eq(chatMessages.id, id)).limit(1)
    return row === undefined ? null : mapMessageRow(row)
  }

  /** The correction goes into the row itself — the previous text is not kept (spec §5 row 4). */
  async updateMessageBody(id: string, body: string): Promise<void> {
    await this.db
      .update(chatMessages)
      .set({ body, editedAt: new Date() })
      .where(eq(chatMessages.id, id))
  }

  /**
   * ⚠ SOFT, and it stays that way. The row is the evidence a claim's thread is kept for, and the
   * seq it holds is what everyone's read marker and recovery window are counted against — a hard
   * delete would tear a hole in both. What stops the words travelling is `mapMessageRow`, which
   * serves an empty body for a deleted row.
   */
  async softDeleteMessage(id: string): Promise<void> {
    await this.db.update(chatMessages).set({ deletedAt: new Date() }).where(eq(chatMessages.id, id))
  }

  /** Muting is per account, so the row is per account — and saying it twice says it once. */
  async insertMute(conversationId: string, userId: string): Promise<void> {
    await this.db.insert(chatMutes).values({ conversationId, userId }).onConflictDoNothing()
  }

  async deleteMute(conversationId: string, userId: string): Promise<void> {
    await this.db
      .delete(chatMutes)
      .where(and(eq(chatMutes.conversationId, conversationId), eq(chatMutes.userId, userId)))
  }

  /** Who pinned it, or null when nobody did. `pinnedBy` is NULL once that account is deleted. */
  async findPin(
    conversationId: string,
    messageId: string,
  ): Promise<{ pinnedBy: string | null } | null> {
    const [row] = await this.db
      .select({ pinnedBy: chatPins.pinnedBy })
      .from(chatPins)
      .where(and(eq(chatPins.conversationId, conversationId), eq(chatPins.messageId, messageId)))
      .limit(1)

    return row ?? null
  }

  async countPins(conversationId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatPins)
      .where(eq(chatPins.conversationId, conversationId))

    return row?.count ?? 0
  }

  async insertPin(conversationId: string, messageId: string, pinnedBy: string): Promise<void> {
    await this.db
      .insert(chatPins)
      .values({ conversationId, messageId, pinnedBy })
      .onConflictDoNothing()
  }

  async deletePin(conversationId: string, messageId: string): Promise<void> {
    await this.db
      .delete(chatPins)
      .where(and(eq(chatPins.conversationId, conversationId), eq(chatPins.messageId, messageId)))
  }

  /** One tick per person per message — the primary key is the whole rule, so a repeat is a no-op. */
  async insertReaction(messageId: string, userId: string): Promise<void> {
    await this.db.insert(chatReactions).values({ messageId, userId }).onConflictDoNothing()
  }

  async deleteReaction(messageId: string, userId: string): Promise<void> {
    await this.db
      .delete(chatReactions)
      .where(and(eq(chatReactions.messageId, messageId), eq(chatReactions.userId, userId)))
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
        unreadCount: unreadCountSql(scope.userId),
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
