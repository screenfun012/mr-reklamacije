import type { ClientRegistrationStatus, UserLanguage } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import { check, foreignKey, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users } from './access-control.js'
import { customers } from './customers.js'
import { citext } from './pg-types.js'

export const clientRegistrationRequests = pgTable(
  'client_registration_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: citext('email').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    companyName: text('company_name'),
    message: text('message'),
    preferredLanguage: text('preferred_language').notNull().default('sr').$type<UserLanguage>(),
    passwordHash: text('password_hash').notNull(),
    status: text('status').notNull().default('pending').$type<ClientRegistrationStatus>(),
    adminNote: text('admin_note'),
    linkedCustomerId: uuid('linked_customer_id'),
    createdUserId: uuid('created_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }),
    reviewedBy: uuid('reviewed_by'),
  },
  (t) => [
    check(
      'client_registration_requests_preferred_language_check',
      sql`${t.preferredLanguage} IN ('sr', 'en')`,
    ),
    check(
      'client_registration_requests_status_check',
      sql`${t.status} IN ('pending', 'approved', 'rejected', 'needs_info')`,
    ),
    foreignKey({
      name: 'client_registration_requests_linked_customer_id_fkey',
      columns: [t.linkedCustomerId],
      foreignColumns: [customers.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'client_registration_requests_created_user_id_fkey',
      columns: [t.createdUserId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'client_registration_requests_reviewed_by_fkey',
      columns: [t.reviewedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  ],
)

export const clientRegistrationRequestsRelations = relations(
  clientRegistrationRequests,
  ({ one }) => ({
    linkedCustomer: one(customers, {
      fields: [clientRegistrationRequests.linkedCustomerId],
      references: [customers.id],
    }),
    createdUser: one(users, {
      relationName: 'client_registration_requests_created_user',
      fields: [clientRegistrationRequests.createdUserId],
      references: [users.id],
    }),
    reviewedByUser: one(users, {
      relationName: 'client_registration_requests_reviewed_by',
      fields: [clientRegistrationRequests.reviewedBy],
      references: [users.id],
    }),
  }),
)
