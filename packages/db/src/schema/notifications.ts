import type { NotificationData, NotificationEntityType, NotificationType } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'

/**
 * In-app notification inbox. One row per RECIPIENT per event — the fan-out happens
 * on write, so "read" is naturally per person and the inbox is a single indexed
 * read. The team is small, so a handful of rows per event costs nothing.
 *
 * `data` carries only what the client needs to render a localized title (MR number,
 * customer name, outcome, catalog item name) — never claim internals.
 *
 * No soft delete: dismissing a popup deliberately does NOT remove the row — it
 * stays unread in the bell. A user CAN explicitly delete their own rows (the
 * inbox is one row per recipient, so that only clears their own bell), but the
 * system never auto-prunes.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    type: text('type').notNull().$type<NotificationType>(),
    entityType: text('entity_type').notNull().$type<NotificationEntityType>(),
    entityId: uuid('entity_id').notNull(),
    data: jsonb('data').notNull().default({}).$type<NotificationData>(),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    /** Set while the user postponed this popup; the row stays unread meanwhile. */
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    check(
      'notifications_type_check',
      sql`${t.type} IN ('new_submission', 'outcome_changed', 'claim_created', 'assigned_to_me', 'catalog_added', 'submission_rejected')`,
    ),
    check(
      'notifications_entity_type_check',
      sql`${t.entityType} IN ('client_submission', 'emotive_claim', 'domace_claim', 'catalog')`,
    ),
    foreignKey({
      name: 'notifications_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    // The inbox page: this user's rows, newest first.
    index('idx_notifications_user_created_at').on(t.userId, t.createdAt.desc()),
    // The bell badge: unread rows only, so the count never scans read history.
    index('idx_notifications_user_unread')
      .on(t.userId)
      .where(sql`${t.isRead} = false`),
  ],
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}))
