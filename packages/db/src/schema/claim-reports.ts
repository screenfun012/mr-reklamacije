import type { ClaimKind, ClaimReportStatus } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'
import { domaceClaims, emotiveClaims } from './claims.js'

/**
 * One formal report per claim (UNIQUE on claim FK). Polymorphic like attachments.
 */
export const claimReports = pgTable(
  'claim_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    claimKind: text('claim_kind').notNull().$type<ClaimKind>(),
    emotiveClaimId: uuid('emotive_claim_id'),
    domaceClaimId: uuid('domace_claim_id'),
    contentJson: jsonb('content_json').notNull(),
    contentHtml: text('content_html').notNull().default(''),
    status: text('status').notNull().default('draft').$type<ClaimReportStatus>(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    check('claim_reports_claim_kind_check', sql`${t.claimKind} IN ('emotive', 'domace')`),
    check(
      'claim_reports_one_of_claim_check',
      sql`
        (${t.claimKind} = 'emotive' AND ${t.emotiveClaimId} IS NOT NULL
         AND ${t.domaceClaimId} IS NULL)
        OR
        (${t.claimKind} = 'domace' AND ${t.emotiveClaimId} IS NULL
         AND ${t.domaceClaimId} IS NOT NULL)
      `,
    ),
    check('claim_reports_status_check', sql`${t.status} IN ('draft')`),
    foreignKey({
      name: 'claim_reports_emotive_claim_id_fkey',
      columns: [t.emotiveClaimId],
      foreignColumns: [emotiveClaims.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'claim_reports_domace_claim_id_fkey',
      columns: [t.domaceClaimId],
      foreignColumns: [domaceClaims.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'claim_reports_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'claim_reports_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    index('idx_claim_reports_emotive_claim_id')
      .on(t.emotiveClaimId)
      .where(sql`${t.emotiveClaimId} IS NOT NULL`),
    index('idx_claim_reports_domace_claim_id')
      .on(t.domaceClaimId)
      .where(sql`${t.domaceClaimId} IS NOT NULL`),
    uniqueIndex('claim_reports_emotive_claim_id_key')
      .on(t.emotiveClaimId)
      .where(sql`${t.emotiveClaimId} IS NOT NULL`),
    uniqueIndex('claim_reports_domace_claim_id_key')
      .on(t.domaceClaimId)
      .where(sql`${t.domaceClaimId} IS NOT NULL`),
  ],
)

export const claimReportsRelations = relations(claimReports, ({ one }) => ({
  emotiveClaim: one(emotiveClaims, {
    fields: [claimReports.emotiveClaimId],
    references: [emotiveClaims.id],
  }),
  domaceClaim: one(domaceClaims, {
    fields: [claimReports.domaceClaimId],
    references: [domaceClaims.id],
  }),
  creator: one(users, {
    fields: [claimReports.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [claimReports.updatedBy],
    references: [users.id],
  }),
}))
