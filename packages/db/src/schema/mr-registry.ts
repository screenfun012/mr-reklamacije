import type { ClaimKind } from '@mr/shared'
import { sql } from 'drizzle-orm'
import { check, foreignKey, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { domaceClaims, emotiveClaims } from './claims.js'

/**
 * Global MR number registry — one active claim per normalized mr_key across
 * emotive_claims and domace_claims. Mirrors attachments polymorphic FK pattern.
 */
export const mrRegistry = pgTable(
  'mr_registry',
  {
    mrKey: text('mr_key').primaryKey(),
    claimKind: text('claim_kind').notNull().$type<ClaimKind>(),
    emotiveClaimId: uuid('emotive_claim_id'),
    domaceClaimId: uuid('domace_claim_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    check('mr_registry_claim_kind_check', sql`${t.claimKind} IN ('emotive', 'domace')`),
    check(
      'mr_registry_one_of_claim_check',
      sql`
        (${t.claimKind} = 'emotive' AND ${t.emotiveClaimId} IS NOT NULL
         AND ${t.domaceClaimId} IS NULL)
        OR
        (${t.claimKind} = 'domace' AND ${t.emotiveClaimId} IS NULL
         AND ${t.domaceClaimId} IS NOT NULL)
      `,
    ),
    foreignKey({
      name: 'mr_registry_emotive_claim_id_fkey',
      columns: [t.emotiveClaimId],
      foreignColumns: [emotiveClaims.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'mr_registry_domace_claim_id_fkey',
      columns: [t.domaceClaimId],
      foreignColumns: [domaceClaims.id],
    }).onDelete('cascade'),
    uniqueIndex('mr_registry_emotive_claim_id_key')
      .on(t.emotiveClaimId)
      .where(sql`${t.emotiveClaimId} IS NOT NULL`),
    uniqueIndex('mr_registry_domace_claim_id_key')
      .on(t.domaceClaimId)
      .where(sql`${t.domaceClaimId} IS NOT NULL`),
  ],
)
