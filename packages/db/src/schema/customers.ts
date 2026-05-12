import type { CustomerKind } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'
import { citext } from './pg-types.js'

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull().$type<CustomerKind>(),
    name: text('name').notNull(),
    taxId: text('tax_id'),
    address: text('address'),
    city: text('city'),
    country: text('country'),
    email: citext('email'),
    phone: text('phone'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    check(
      'customers_kind_check',
      sql`${t.kind} IN ('emotive_partner', 'domestic_company', 'domestic_individual')`,
    ),
  ],
)

export const customerUsers = pgTable(
  'customer_users',
  {
    customerId: uuid('customer_id').notNull(),
    userId: uuid('user_id').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    assignedBy: uuid('assigned_by').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.customerId, t.userId] }),
    foreignKey({
      name: 'customer_users_customer_id_fkey',
      columns: [t.customerId],
      foreignColumns: [customers.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'customer_users_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'customer_users_assigned_by_fkey',
      columns: [t.assignedBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    index('idx_customer_users_user_id').on(t.userId),
  ],
)

export const customersRelations = relations(customers, ({ many }) => ({
  customerUsers: many(customerUsers),
}))

export const customerUsersRelations = relations(customerUsers, ({ one }) => ({
  customer: one(customers, {
    fields: [customerUsers.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    relationName: 'customer_users_user',
    fields: [customerUsers.userId],
    references: [users.id],
  }),
  assigner: one(users, {
    relationName: 'customer_users_assigned_by',
    fields: [customerUsers.assignedBy],
    references: [users.id],
  }),
}))
