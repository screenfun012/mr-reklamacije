import { foreignKey, index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'

import { emotiveClaims } from './claims.js'
import { users } from './access-control.js'

export const emotiveClaimClientViews = pgTable(
  'emotive_claim_client_views',
  {
    userId: uuid('user_id').notNull(),
    emotiveClaimId: uuid('emotive_claim_id').notNull(),
    viewedAt: timestamp('viewed_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.emotiveClaimId] }),
    foreignKey({
      name: 'emotive_claim_client_views_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'emotive_claim_client_views_claim_id_fkey',
      columns: [t.emotiveClaimId],
      foreignColumns: [emotiveClaims.id],
    }).onDelete('cascade'),
    index('idx_emotive_claim_client_views_claim_id').on(t.emotiveClaimId),
  ],
)
