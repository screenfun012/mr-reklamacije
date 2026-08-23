import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'
import { domaceClaims, emotiveClaims } from './claims.js'

/**
 * The shop's own chat ("Razgovori") — internal team only, never the portal.
 *
 * Three kinds of conversation: the one general channel, channels the team makes for a topic, and
 * one thread per claim. Design: `docs/superpowers/specs/2026-08-23-cet-razgovori-design.md`.
 */
export const chatConversations = pgTable(
  'chat_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    /** Required for a channel, meaningless for the other two — a thread is named by its claim. */
    name: text('name'),
    emotiveClaimId: uuid('emotive_claim_id'),
    domaceClaimId: uuid('domace_claim_id'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    check('chat_conversations_type_check', sql`${t.type} IN ('general', 'channel', 'claim')`),
    /**
     * A claim is not one table and the two families share no id space, so "which claim" is a
     * nullable PAIR with a one-of CHECK — the same answer `mr_registry` already gives to exactly
     * this question. A single `claim_id` column cannot exist here.
     */
    check(
      'chat_conversations_one_of_claim_check',
      sql`
        (${t.type} = 'claim' AND (
          (${t.emotiveClaimId} IS NOT NULL AND ${t.domaceClaimId} IS NULL) OR
          (${t.emotiveClaimId} IS NULL AND ${t.domaceClaimId} IS NOT NULL)))
        OR
        (${t.type} <> 'claim' AND ${t.emotiveClaimId} IS NULL AND ${t.domaceClaimId} IS NULL)
      `,
    ),
    check(
      'chat_conversations_channel_name_check',
      sql`${t.type} <> 'channel' OR ${t.name} IS NOT NULL`,
    ),
    // „1 reklamacija = 1 nit" (spec §8.3). PARTIAL, so a removed thread frees its claim again.
    uniqueIndex('uq_chat_conversations_emotive_claim')
      .on(t.emotiveClaimId)
      .where(sql`${t.emotiveClaimId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    uniqueIndex('uq_chat_conversations_domace_claim')
      .on(t.domaceClaimId)
      .where(sql`${t.domaceClaimId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    // One general channel per shop, and it is the one that cannot be deleted.
    uniqueIndex('uq_chat_conversations_general')
      .on(t.type)
      .where(sql`${t.type} = 'general'`),
    index('idx_chat_conversations_updated_at').on(t.updatedAt),
    foreignKey({
      name: 'chat_conversations_emotive_claim_id_fkey',
      columns: [t.emotiveClaimId],
      foreignColumns: [emotiveClaims.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'chat_conversations_domace_claim_id_fkey',
      columns: [t.domaceClaimId],
      foreignColumns: [domaceClaims.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'chat_conversations_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  ],
)

/** Who is in a channel. The general channel has no rows — everyone internal is in it. */
export const chatMembers = pgTable(
  'chat_members',
  {
    conversationId: uuid('conversation_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ name: 'chat_members_pkey', columns: [t.conversationId, t.userId] }),
    index('idx_chat_members_user_id').on(t.userId),
    foreignKey({
      name: 'chat_members_conversation_id_fkey',
      columns: [t.conversationId],
      foreignColumns: [chatConversations.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'chat_members_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
  ],
)

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').notNull(),
    /**
     * ⚠ THE ORDER KEY. Never `created_at`: the primary keys here are UUID v4 and unsortable, and
     * equal timestamps would be untied by randomness. Ordering, "how far have I read", paging and
     * the recovery of a message missed while disconnected all hang on this one column.
     *
     * It is assigned at INSERT and becomes visible at COMMIT, so a reader can see 42 while 41 is
     * still uncommitted. That is why the client never asks for `> maxSeen` but for
     * `> maxSeen - CHAT_RECOVERY_OVERLAP` and drops ids it already holds. Do not "optimise" that
     * overlap away — it is the whole reason no message is lost.
     */
    seq: bigserial('seq', { mode: 'bigint' }).notNull(),
    /**
     * Minted by the sender BEFORE the request. Makes a retry — a flaky tablet, a resent POST —
     * land exactly once, and it is the same key the recovery window deduplicates by.
     */
    clientMsgId: uuid('client_msg_id').notNull(),
    /** NULL for a system message, and NULL once the author's account is deleted. */
    authorId: uuid('author_id'),
    body: text('body').notNull(),
    quoteOf: uuid('quote_of'),
    systemKind: text('system_kind'),
    systemMeta: jsonb('system_meta').$type<Record<string, string>>(),
    editedAt: timestamp('edited_at', { withTimezone: true, mode: 'date' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    // The only index the read path needs: every read is keyset by conversation, ordered by seq.
    index('idx_chat_messages_conversation_seq').on(t.conversationId, t.seq),
    uniqueIndex('uq_chat_messages_author_client_msg')
      .on(t.authorId, t.clientMsgId)
      .where(sql`${t.authorId} IS NOT NULL`),
    foreignKey({
      name: 'chat_messages_conversation_id_fkey',
      columns: [t.conversationId],
      foreignColumns: [chatConversations.id],
    }).onDelete('cascade'),
    /**
     * SET NULL, never CASCADE: the messages are evidence for a claim (spec §8.7) and an account
     * gets switched off when someone leaves. Deleting a person must not erase what was said.
     */
    foreignKey({
      name: 'chat_messages_author_id_fkey',
      columns: [t.authorId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'chat_messages_quote_of_fkey',
      columns: [t.quoteOf],
      foreignColumns: [t.id],
    }).onDelete('set null'),
  ],
)

/** How far each person has read each conversation. The ONE source of the unread number. */
export const chatReads = pgTable(
  'chat_reads',
  {
    conversationId: uuid('conversation_id').notNull(),
    userId: uuid('user_id').notNull(),
    lastSeq: bigint('last_seq', { mode: 'bigint' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ name: 'chat_reads_pkey', columns: [t.conversationId, t.userId] }),
    foreignKey({
      name: 'chat_reads_conversation_id_fkey',
      columns: [t.conversationId],
      foreignColumns: [chatConversations.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'chat_reads_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
  ],
)

export const chatPins = pgTable(
  'chat_pins',
  {
    conversationId: uuid('conversation_id').notNull(),
    messageId: uuid('message_id').notNull(),
    pinnedBy: uuid('pinned_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ name: 'chat_pins_pkey', columns: [t.conversationId, t.messageId] }),
    foreignKey({
      name: 'chat_pins_conversation_id_fkey',
      columns: [t.conversationId],
      foreignColumns: [chatConversations.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'chat_pins_message_id_fkey',
      columns: [t.messageId],
      foreignColumns: [chatMessages.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'chat_pins_pinned_by_fkey',
      columns: [t.pinnedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  ],
)

/** One reaction, one person, one message — the tick. No emoji column: there is one reaction. */
export const chatReactions = pgTable(
  'chat_reactions',
  {
    messageId: uuid('message_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ name: 'chat_reactions_pkey', columns: [t.messageId, t.userId] }),
    foreignKey({
      name: 'chat_reactions_message_id_fkey',
      columns: [t.messageId],
      foreignColumns: [chatMessages.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'chat_reactions_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
  ],
)

/** Muting is per ACCOUNT, not per browser — it must survive devices and the server reads it. */
export const chatMutes = pgTable(
  'chat_mutes',
  {
    conversationId: uuid('conversation_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ name: 'chat_mutes_pkey', columns: [t.conversationId, t.userId] }),
    foreignKey({
      name: 'chat_mutes_conversation_id_fkey',
      columns: [t.conversationId],
      foreignColumns: [chatConversations.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'chat_mutes_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
  ],
)
