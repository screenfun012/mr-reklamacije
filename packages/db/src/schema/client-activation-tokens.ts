import { relations } from 'drizzle-orm'
import { foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { users } from './access-control.js'

/**
 * Single-use, expiring tokens for passwordless client activation. Only the SHA-256
 * hash of the token is stored (the raw token lives only in the emailed link). A
 * token is consumed by stamping `used_at`; expiry is enforced via `expires_at`.
 */
export const clientActivationTokens = pgTable(
  'client_activation_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('client_activation_tokens_token_hash_key').on(t.tokenHash),
    index('idx_client_activation_tokens_user_id').on(t.userId),
    foreignKey({
      name: 'client_activation_tokens_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
  ],
)

export const clientActivationTokensRelations = relations(clientActivationTokens, ({ one }) => ({
  user: one(users, {
    fields: [clientActivationTokens.userId],
    references: [users.id],
  }),
}))
