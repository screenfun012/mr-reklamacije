import type { PushSubscriptionMode } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'

/**
 * One browser's standing permission to be told about a new chat message.
 *
 * ⚠ `endpoint` is unique GLOBALLY, not per user, and that is the subtle part. The same browser on
 * the same device hands back the same address every time, so when a second person signs in there
 * the subscription must be TAKEN OVER rather than duplicated — otherwise the previous user goes on
 * receiving the shop's messages on a device that is no longer theirs. The write is therefore
 * `ON CONFLICT (endpoint) DO UPDATE`, and the unique index is what makes that possible at all.
 *
 * ⚠ There is no `last_seen_at`. It was in the first draft with nothing writing it and nothing
 * reading it, and a column nobody touches is a promise the next person will believe. Growth is
 * small on its own: a row appears only when somebody deliberately turns push on, and a replaced
 * endpoint comes back from the push service as 410, which deletes it.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    /** The push service's address for this browser. Opaque, and long — never parsed. */
    endpoint: text('endpoint').notNull(),
    /** The browser's public key and auth secret, for encrypting the payload to it (RFC 8291). */
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    /** Only so a person can tell their own devices apart in the list — never matched on. */
    userAgent: text('user_agent'),
    mode: text('mode').notNull().default('all').$type<PushSubscriptionMode>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    check('push_subscriptions_mode_check', sql`${t.mode} IN ('all', 'mentions', 'no_text')`),
    foreignKey({
      name: 'push_subscriptions_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
      // The account goes, its phones go with it. There is nobody left to notify.
    }).onDelete('cascade'),
    index('idx_push_subscriptions_user_id').on(t.userId),
    // The take-over above needs this to be UNIQUE — it is what `ON CONFLICT (endpoint)` infers,
    // and what makes one device exactly one row.
    uniqueIndex('uq_push_subscriptions_endpoint').on(t.endpoint),
  ],
)

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}))
