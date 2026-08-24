import {
  ChatConversationType,
  ClaimKind,
  ClaimOutcome,
  findMentions,
  getInitials,
  INTERNAL_APP_PERMISSIONS,
  INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS,
  INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS,
  AttachmentPurpose,
  CHAT_QUOTE_EXCERPT_MAX,
  MENTION_EVERYONE_ID,
  stripMentionMarkup,
  uniqueMentions,
  SYSTEM_ROLE_ADMIN,
  UserAccountStatus,
  type ChatMention,
  type ChatPin,
  type ChatAttachment,
  type ChatReactor,
  type ChatQuote,
  type ChatSystemKind,
  type Permission,
} from '@mr/shared'
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import {
  attachments,
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
  rolePermissions,
  roles,
  userRoles,
  users,
} from './chat.schema.js'
import type {
  ChatConversationListItem,
  ChatMessage,
  ChatMessagesPage,
  ChatMessagesQuery,
} from './chat.validators.js'

/** One row of the mention menu, before initials are computed for it. */
export interface ChatPersonRow {
  id: string
  name: string
  email: string
}

/**
 * `id = ANY($1::uuid[])` — one bind parameter, whatever the list holds.
 *
 * ⚠ It must be `sql.param`. Interpolating a bare array into an `sql` template does NOT bind an
 * array: drizzle walks the array and emits `($1, $2, $3)` (`drizzle-orm/sql/sql.js`, the
 * `Array.isArray(chunk)` branch), which is a row constructor — `ANY(($1, $2, $3))` is a syntax
 * error no cast can rescue. `sql.param` wraps the value so it is handled as a single `Param`
 * before that branch is ever reached.
 *
 * Why not `inArray`: it emits one placeholder per id. A message body may carry ~95 mentions and a
 * page 100 bodies, so a pathological conversation would plan a ~9,500-element `IN` on every read,
 * for every reader, forever.
 */
export function mentionedUserIds(ids: readonly string[]): SQL {
  return sql`${users.id} = ANY(${sql.param([...ids])}::uuid[])`
}

/**
 * Which permission opens this conversation — the same sets `scopeFor` reads, never a literal.
 *
 * ⚠ A `switch` with `never` on the end rather than an `if`: a fourth conversation type (a direct
 * message is the obvious one) would otherwise land in the general branch and offer the WHOLE
 * internal office as mentionable in a two-person room, with typecheck still green.
 */
function claimReaderPermissions(conversation: ChatConversationListItem): Permission[] {
  switch (conversation.type) {
    case ChatConversationType.Claim:
      return conversation.claimKind === ClaimKind.Domace
        ? [...INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS]
        : [...INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS]
    case ChatConversationType.General:
      return [...INTERNAL_APP_PERMISSIONS]
    case ChatConversationType.Channel:
      // Handled by its own branch above — a channel's people are its member rows, not a permission.
      return []
    default: {
      const unreachable: never = conversation.type
      return unreachable
    }
  }
}

/**
 * Only a live, approved account. The same gate the login uses and the same one the notifications
 * fan-out uses — a name in this menu that cannot receive a mention is a lie with a click on it.
 */
function isLiveAccount(): SQL | undefined {
  return and(
    eq(users.isActive, true),
    eq(users.accountStatus, UserAccountStatus.Approved),
    isNull(users.deletedAt),
  )
}

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
  isLocked: boolean
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
 * Whether this row's claim has been decided — the whole of "the thread is closed" (Nikola,
 * 2026-08-23). A general channel and a topic channel are never locked; they belong to nobody's
 * outcome.
 */
const isLockedSql = sql<boolean>`(
  ${chatConversations.type} = ${ChatConversationType.Claim}
  AND COALESCE(${emotiveClaims.outcome}, ${domaceClaims.outcome}) IS NOT NULL
  AND COALESCE(${emotiveClaims.outcome}, ${domaceClaims.outcome}) <> ${ClaimOutcome.Pending}
)`

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
    isLocked: row.isLocked,
    isMuted: row.isMuted,
    lastMessageAt: row.lastMessageAt === null ? null : new Date(row.lastMessageAt).toISOString(),
  }
}

/**
 * Every person a message names, once each, in writing order.
 *
 * ⚠ The once-each rule is `uniqueMentions` from `@mr/shared`, not a `Set` here: the composer has to
 * produce this same field for the row it shows before the server answers, and the one time this
 * rule lived in two places the second copy forgot it.
 *
 * An id that resolves to nobody gets NO name — and nobody means nobody LIVE. The screen then falls
 * back to the words that were typed, drawn as words rather than as a chip: a colleague who has left
 * still reads under the name he had, and nobody can forge something that looks like a link to a
 * real person in a conversation that is evidence for a claim.
 */
function mentionsOf(body: string, names: ReadonlyMap<string, string>): ChatMention[] {
  return uniqueMentions(body).map((mention) => ({
    id: mention.id,
    // `null` for `@svi` (the screen names it) and for an id with no live account behind it (the
    // screen then draws the words that were typed, not a chip pointing at nobody).
    name: mention.id === MENTION_EVERYONE_ID ? null : (names.get(mention.id) ?? null),
  }))
}

/**
 * ⚠ Mentions are read from the body this function PUBLISHES, not from the stored one. A deleted
 * message publishes empty words, so it publishes no mentions either — otherwise the row would keep
 * naming people out of a sentence nobody can read any more.
 */
/**
 * Does this message carry a file? One definition, used by both the quoted block and the pinned bar.
 *
 * A photo on its own is a message, so its excerpt is empty — the two places that draw an excerpt
 * both need this or they draw a blank line. Written once because it is a predicate over a SHARED
 * table: `purpose` is matched positively here exactly as it is everywhere else.
 */
const hasAttachmentSql = sql<boolean>`EXISTS (
  SELECT 1 FROM ${attachments}
  WHERE ${attachments.chatMessageId} = ${chatMessages.id}
    AND ${attachments.purpose} = ${AttachmentPurpose.ChatAttachment}
    AND ${attachments.deletedAt} IS NULL
)`

function mapMessageRow(
  row: MessageRow,
  names: ReadonlyMap<string, string>,
  quotes: ReadonlyMap<string, ChatQuote>,
  seenByAll: (row: MessageRow) => boolean,
  reactors: ReadonlyMap<string, ChatReactor[]>,
  files: ReadonlyMap<string, ChatAttachment[]>,
): ChatMessage {
  const body = row.deletedAt === null ? row.body : ''
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
    mentions: mentionsOf(body, names),
    // The row stays so the screen can say a message was here; the words do not travel (spec §5.5).
    body,
    quote: row.quoteOf === null ? null : (quotes.get(row.quoteOf) ?? null),
    systemKind: row.systemKind as ChatSystemKind | null,
    systemMeta: row.systemMeta,
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    seenByAll: seenByAll(row),
    reactedBy: reactors.get(row.id) ?? [],
    // A withdrawn message keeps its row and loses its contents — the file goes with the words.
    attachments: row.deletedAt === null ? (files.get(row.id) ?? []) : [],
  }
}

/** One attachment row as the chat writes it — the columns a chat file has, and no others. */
export interface NewChatAttachmentRow {
  readonly id: string
  readonly chatMessageId: string
  readonly fileName: string
  readonly storagePath: string
  readonly mimeType: string
  readonly fileSizeBytes: number
  readonly contentSha256: string
  readonly width: number | null
  readonly height: number | null
  readonly thumbnailPath: string | null
  readonly purpose: typeof AttachmentPurpose.ChatAttachment
}

export class ChatRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listConversations(scope: ChatVisibilityScope): Promise<ChatConversationListItem[]> {
    const rows = await this.conversationSelect(scope)
      // ⚠ The list only. `findVisibleConversation` still finds a closed thread, because the claim's
      // own „Razgovor" tab has to keep reading it — it is evidence, it just takes no more words.
      .where(
        and(
          isNull(chatConversations.deletedAt),
          visibleConversationCondition(scope),
          sql`NOT ${isLockedSql}`,
        ),
      )
      // The general channel is home, then whatever spoke last.
      .orderBy(
        sql`(${chatConversations.type} = ${ChatConversationType.General}) DESC`,
        sql`${lastMessageAtSql} DESC NULLS LAST`,
        desc(chatConversations.createdAt),
      )

    return rows.map(mapConversationRow)
  }

  /**
   * The names behind every id mentioned across these bodies — ONE query for a whole page.
   *
   * Per message it would be one request per chip, and a busy channel draws fifty of them. The
   * reserved `@svi` id belongs to nobody and is never looked up.
   *
   * ⚠ Only LIVE accounts, the same filter the mention menu uses. Without it, writing any uuid into
   * a message published that account's current name to the room — a closed account, a rejected
   * one, a portal client. The menu offers nobody who is not live, so an id that is not live was
   * either typed by hand or belongs to somebody who has since left; both read better as the name
   * that was written at the time.
   *
   * ⚠ ONE bind parameter whatever the page holds — see `mentionedUserIds`.
   */
  private async resolveMentionNames(bodies: readonly string[]): Promise<Map<string, string>> {
    const ids = new Set<string>()
    for (const body of bodies) {
      for (const mention of findMentions(body)) {
        if (mention.id !== MENTION_EVERYONE_ID) {
          ids.add(mention.id)
        }
      }
    }
    if (ids.size === 0) {
      return new Map()
    }

    const rows = await this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(isLiveAccount(), mentionedUserIds([...ids])))

    return new Map(rows.map((row) => [row.id, row.name]))
  }

  /**
   * Who has got how far — the ≤9 marker rows for this conversation, once.
   *
   * ⚠ Derived, not stored. A receipt row per person per message would be ~1,600 rows a day that
   * nothing ever cleans, to answer a question nine markers already answer exactly: `chat_reads`
   * holds a high-water mark, so "has this person got past message X" is one comparison. The spec
   * refused a notification row per message for the same reason (§3.2).
   */
  private async readMarkers(conversationId: string): Promise<Map<string, bigint>> {
    const rows = await this.db
      .select({ userId: chatReads.userId, lastSeq: chatReads.lastSeq })
      .from(chatReads)
      .where(eq(chatReads.conversationId, conversationId))

    return new Map(rows.map((row) => [row.userId, BigInt(row.lastSeq)]))
  }

  /**
   * The test behind the two coloured ticks: has EVERYBODY who can see this room got at least this
   * far? Somebody with no marker at all has not — never "assume yes" — and the person who wrote
   * the message is not waited on, because he never marks his own words read.
   */
  private async seenByAllTest(
    conversation: ChatConversationListItem,
  ): Promise<(row: MessageRow) => boolean> {
    const [audience, markers] = await Promise.all([
      this.listPeopleFor(conversation),
      this.readMarkers(conversation.id),
    ])

    return (row: MessageRow) =>
      audience.every(
        (person) => person.id === row.authorId || (markers.get(person.id) ?? 0n) >= row.seq,
      )
  }

  /**
   * The messages being answered on this page — ONE query, whatever the page holds.
   *
   * ⚠ Not a join on the page itself: a quoted message is usually OLDER than the page and would not
   * be in it. And no visibility filter is needed here, because a quote is already refused unless it
   * points inside the same conversation (`ChatService.send`) — so anything reachable this way is
   * something the reader may already read.
   */
  private async resolveQuotes(quoteIds: readonly string[]): Promise<Map<string, ChatQuote>> {
    const ids = [...new Set(quoteIds)]
    if (ids.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select({
        id: chatMessages.id,
        body: chatMessages.body,
        deletedAt: chatMessages.deletedAt,
        authorName: users.name,
        hasAttachment: hasAttachmentSql,
      })
      .from(chatMessages)
      .leftJoin(users, eq(users.id, chatMessages.authorId))
      .where(inArray(chatMessages.id, ids))

    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          authorName: row.authorName ?? '',
          // A withdrawn message says so; its words do not travel here either (spec §5.5).
          excerpt:
            row.deletedAt === null
              ? stripMentionMarkup(row.body).slice(0, CHAT_QUOTE_EXCERPT_MAX)
              : '',
          isDeleted: row.deletedAt !== null,
          // The file goes with the words: a withdrawn message shows neither.
          hasAttachment: row.deletedAt === null && row.hasAttachment,
        },
      ]),
    )
  }

  /**
   * Who liked what, for a whole page at once — ONE query, like the quotes above.
   *
   * ⚠ It used to be two scalar sub-selects on the page query (a count and an EXISTS). Both were
   * correct and neither could say who, which is the only thing the green chip is for.
   *
   * ⚠ The order is STABLE, not chronological: two people liking within the same transaction share
   * a timestamp, so the id breaks the tie. It is here only so a refetch does not reshuffle the
   * names under somebody's eyes — nothing reads meaning into the sequence.
   */
  private async resolveReactors(
    messageIds: readonly string[],
  ): Promise<Map<string, ChatReactor[]>> {
    const ids = [...new Set(messageIds)]
    if (ids.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select({
        messageId: chatReactions.messageId,
        userId: chatReactions.userId,
        name: users.name,
      })
      .from(chatReactions)
      .innerJoin(users, eq(users.id, chatReactions.userId))
      .where(inArray(chatReactions.messageId, ids))
      .orderBy(asc(chatReactions.createdAt), asc(chatReactions.userId))

    const byMessage = new Map<string, ChatReactor[]>()
    for (const row of rows) {
      const held = byMessage.get(row.messageId) ?? []
      held.push({ id: row.userId, name: row.name })
      byMessage.set(row.messageId, held)
    }
    return byMessage
  }

  /**
   * Every file across a whole page of messages — ONE query, the way the reactors are read.
   *
   * ⚠ `purpose` is matched POSITIVELY. A negation would also admit whatever purpose is added next,
   * and this table is shared with claim photos, report images and intake quotes.
   */
  private async resolveAttachments(
    messageIds: readonly string[],
  ): Promise<Map<string, ChatAttachment[]>> {
    const ids = [...new Set(messageIds)]
    if (ids.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select({
        messageId: attachments.chatMessageId,
        id: attachments.id,
        fileName: attachments.fileName,
        mimeType: attachments.mimeType,
        fileSizeBytes: attachments.fileSizeBytes,
        width: attachments.width,
        height: attachments.height,
        thumbnailPath: attachments.thumbnailPath,
      })
      .from(attachments)
      .where(
        and(
          inArray(attachments.chatMessageId, ids),
          eq(attachments.purpose, AttachmentPurpose.ChatAttachment),
          isNull(attachments.deletedAt),
        ),
      )
      .orderBy(asc(attachments.uploadedAt), asc(attachments.id))

    const byMessage = new Map<string, ChatAttachment[]>()
    for (const row of rows) {
      if (row.messageId === null) {
        continue
      }
      const held = byMessage.get(row.messageId) ?? []
      held.push({
        id: row.id,
        fileName: row.fileName,
        mimeType: row.mimeType,
        fileSizeBytes: Number(row.fileSizeBytes),
        width: row.width,
        height: row.height,
        hasThumbnail: row.thumbnailPath !== null,
      })
      byMessage.set(row.messageId, held)
    }
    return byMessage
  }

  /** Every message id in this room — needed before it goes, to let the bell forget them. */
  async listMessageIds(conversationId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))

    return rows.map((row) => row.id)
  }

  /**
   * Erases a room. Not a soft delete — Nikola's words were "kao da nikada nije bila".
   *
   * ⚠ The only hard delete in this module, and it is deliberate: this is for a room made by
   * mistake, not for tidying history. Everything under it follows through the foreign keys
   * (messages, reads, pins, reactions, mutes, members), and the claim's partial unique index frees
   * the claim again, so a thread can be made for it later. What does NOT follow is the audit row —
   * that is the point of writing one, and it is the only trace left that the room existed.
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.db.delete(chatConversations).where(eq(chatConversations.id, conversationId))
  }

  /**
   * The people who may see this conversation, and therefore the only people a mention here may
   * name. Three different questions, one per type: the general channel is the whole internal
   * office, a claim thread is whoever may read that claim, a channel is its members.
   *
   * ⚠ The `admin` branch matches by role CODE, not by `role_permissions`. The permission resolver
   * hard-codes ALL_PERMISSIONS for admins, so an admin may own zero junction rows and a plain join
   * would drop the one account that can always be reached. Same reason, same shape as the
   * notifications fan-out — the two must agree or a mention promises what the bell cannot keep.
   *
   * ⚠ The claim branch reads the INTERNAL_* SETS, never the permission strings. `scopeFor` decides
   * who is IN the room from those same sets; typing the literal here means the day a set gains a
   * member, somebody standing in the room cannot be found in its mention menu — and both halves
   * stay green, because each is consistent with itself.
   */
  async listPeopleFor(conversation: ChatConversationListItem): Promise<ChatPersonRow[]> {
    if (conversation.type === ChatConversationType.Channel) {
      return this.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .innerJoin(chatMembers, eq(chatMembers.userId, users.id))
        .where(and(isLiveAccount(), eq(chatMembers.conversationId, conversation.id)))
        .orderBy(users.name)
    }

    const permissions: Permission[] = claimReaderPermissions(conversation)

    return this.db
      .selectDistinct({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(
        rolePermissions,
        and(
          eq(rolePermissions.roleId, roles.id),
          inArray(rolePermissions.permissionId, permissions),
        ),
      )
      .where(
        and(
          isLiveAccount(),
          isNull(roles.deletedAt),
          or(eq(roles.code, SYSTEM_ROLE_ADMIN), isNotNull(rolePermissions.permissionId)),
        ),
      )
      .orderBy(users.name)
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
    conversation: ChatConversationListItem,
    query: ChatMessagesQuery,
  ): Promise<ChatMessagesPage> {
    const conversationId = conversation.id
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

    const rows = await this.messageSelect()
      .where(and(...conditions))
      .orderBy(forward ? asc(chatMessages.seq) : desc(chatMessages.seq))
      .limit(query.limit + 1)

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const ordered = forward ? page : [...page].reverse()
    const names = await this.resolveMentionNames(
      ordered.map((row) => (row.deletedAt === null ? row.body : '')),
    )
    const quotes = await this.resolveQuotes(
      ordered.map((row) => row.quoteOf).filter((id): id is string => id !== null),
    )
    const seenByAll = await this.seenByAllTest(conversation)
    const reactors = await this.resolveReactors(ordered.map((row) => row.id))
    const files = await this.resolveAttachments(ordered.map((row) => row.id))
    const items = ordered.map((row) =>
      mapMessageRow(row, names, quotes, seenByAll, reactors, files),
    )
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

  /**
   * The rows for one message's files, written together after the message is known to be new.
   *
   * ⚠ `purpose` is passed explicitly and never left to the column default: the default is
   * `claim_attachment`, and the portal is handed every image carrying THAT purpose whatever the
   * visibility column says. Forgetting it here would not leak (a chat row has no claim id, so no
   * claim query finds it) — it would do the opposite and make the photo vanish from its own
   * message, because every chat read filters the purpose positively.
   */
  async insertChatAttachments(rows: readonly NewChatAttachmentRow[]): Promise<void> {
    if (rows.length === 0) {
      return
    }
    await this.db.insert(attachments).values([...rows])
  }

  /**
   * One file, resolved THROUGH its own message.
   *
   * ⚠ The conversation id is a condition of this query, not a separate check before it. Asking
   * "may he open conversation X?" and then "give me file Y" authorises the wrong thing: the
   * general channel is visible to everybody unconditionally, so a serviser who sees no claim
   * thread could ask for a thread's photo through the general channel and be handed it. Both
   * halves must hold in the same WHERE.
   *
   * A withdrawn message stops serving its file too — taking the message back is the only way to
   * remove one (Nikola, 2026-08-24), so this is where that promise is kept.
   */
  async findChatAttachment(
    conversationId: string,
    attachmentId: string,
  ): Promise<{
    storagePath: string
    mimeType: string
    fileName: string
    thumbnailPath: string | null
    contentSha256: string | null
  } | null> {
    const [row] = await this.db
      .select({
        storagePath: attachments.storagePath,
        mimeType: attachments.mimeType,
        fileName: attachments.fileName,
        thumbnailPath: attachments.thumbnailPath,
        contentSha256: attachments.contentSha256,
      })
      .from(attachments)
      .innerJoin(chatMessages, eq(chatMessages.id, attachments.chatMessageId))
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.purpose, AttachmentPurpose.ChatAttachment),
          isNull(attachments.deletedAt),
          eq(chatMessages.conversationId, conversationId),
          isNull(chatMessages.deletedAt),
        ),
      )
      .limit(1)

    return row ?? null
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

  async findMessageById(id: string): Promise<ChatMessage | null> {
    const [row] = await this.messageSelect().where(eq(chatMessages.id, id)).limit(1)
    if (row === undefined) {
      return null
    }
    const names = await this.resolveMentionNames([row.deletedAt === null ? row.body : ''])
    const quotes = await this.resolveQuotes(row.quoteOf === null ? [] : [row.quoteOf])
    const reactors = await this.resolveReactors([row.id])
    // ⚠ Files here too, not only in the list: this is the shape a SEND answers with, and a photo
    // that appears one refresh later reads as a broken upload.
    const files = await this.resolveAttachments([row.id])
    // A single message is read for an ACTION (edit, pin, react), never to be drawn with ticks.
    return mapMessageRow(row, names, quotes, () => false, reactors, files)
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

  /**
   * The whole shortlist, newest pin first — at most `CHAT_PINS_MAX` rows, so it is not paged.
   *
   * The excerpt is cut the same way a quoted block is cut, by the same constant: a pin and a quote
   * are the same sentence shown somewhere else, and two lengths would be two answers to one
   * question. A withdrawn message keeps its place and loses its words.
   */
  async listPins(conversationId: string): Promise<ChatPin[]> {
    const rows = await this.db
      .select({
        id: chatMessages.id,
        body: chatMessages.body,
        deletedAt: chatMessages.deletedAt,
        authorName: users.name,
        pinnedBy: chatPins.pinnedBy,
        hasAttachment: hasAttachmentSql,
      })
      .from(chatPins)
      .innerJoin(chatMessages, eq(chatMessages.id, chatPins.messageId))
      .leftJoin(users, eq(users.id, chatMessages.authorId))
      .where(eq(chatPins.conversationId, conversationId))
      .orderBy(desc(chatPins.createdAt))

    return rows.map((row) => ({
      id: row.id,
      authorName: row.authorName ?? '',
      excerpt:
        row.deletedAt === null ? stripMentionMarkup(row.body).slice(0, CHAT_QUOTE_EXCERPT_MAX) : '',
      isDeleted: row.deletedAt !== null,
      hasAttachment: row.deletedAt === null && row.hasAttachment,
      pinnedBy: row.pinnedBy,
    }))
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

  /**
   * One shape for a message, wherever it is read from — a page, or the one just written.
   *
   * ⚠ It takes no reader any more. It used to, for a `reactedByMe` EXISTS sub-select; who liked a
   * message is now read once per page by `resolveReactors`, and the same rows answer both "how
   * many" and "which of them is me".
   */
  private messageSelect() {
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
        isLocked: isLockedSql,
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
