import type { ClientSubmissionStatus } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import { check, foreignKey, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users } from './access-control.js'
import { emotiveClaims } from './claims.js'
import { customers } from './customers.js'

/**
 * Client portal submissions ("Pristiglo" inbox) — a logged-in portal client sends a
 * lightweight request (the claim reason + attachments). An employee later converts it
 * into an EMOTIVE claim or rejects it (see docs/18). Soft-deleted like all business data.
 */
export const clientSubmissions = pgTable(
  'client_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').notNull(),
    submittedByUserId: uuid('submitted_by_user_id').notNull(),
    message: text('message').notNull(),
    status: text('status').notNull().default('pending').$type<ClientSubmissionStatus>(),
    linkedEmotiveClaimId: uuid('linked_emotive_claim_id'),
    rejectedReason: text('rejected_reason'),
    handledByUserId: uuid('handled_by_user_id'),
    handledAt: timestamp('handled_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    check(
      'client_submissions_status_check',
      sql`${t.status} IN ('pending', 'converted', 'rejected')`,
    ),
    foreignKey({
      name: 'client_submissions_customer_id_fkey',
      columns: [t.customerId],
      foreignColumns: [customers.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'client_submissions_submitted_by_user_id_fkey',
      columns: [t.submittedByUserId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'client_submissions_linked_emotive_claim_id_fkey',
      columns: [t.linkedEmotiveClaimId],
      foreignColumns: [emotiveClaims.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'client_submissions_handled_by_user_id_fkey',
      columns: [t.handledByUserId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    index('idx_client_submissions_customer_id').on(t.customerId),
    index('idx_client_submissions_status').on(t.status),
    index('idx_client_submissions_created_at').on(t.createdAt.desc()),
  ],
)

export const clientSubmissionsRelations = relations(clientSubmissions, ({ one }) => ({
  customer: one(customers, {
    fields: [clientSubmissions.customerId],
    references: [customers.id],
  }),
  submitter: one(users, {
    relationName: 'client_submissions_submitted_by',
    fields: [clientSubmissions.submittedByUserId],
    references: [users.id],
  }),
  linkedEmotiveClaim: one(emotiveClaims, {
    fields: [clientSubmissions.linkedEmotiveClaimId],
    references: [emotiveClaims.id],
  }),
  handler: one(users, {
    relationName: 'client_submissions_handled_by',
    fields: [clientSubmissions.handledByUserId],
    references: [users.id],
  }),
}))
