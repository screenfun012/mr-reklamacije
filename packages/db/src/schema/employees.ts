import { relations } from 'drizzle-orm'
import {
  boolean,
  date,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'

export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    nameSr: text('name_sr').notNull(),
    nameEn: text('name_en').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [uniqueIndex('departments_code_key').on(t.code)],
)

export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    userId: uuid('user_id'),
    hireDate: date('hire_date', { mode: 'date' }),
    terminatedAt: date('terminated_at', { mode: 'date' }),
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    uniqueIndex('employees_normalized_name_key').on(t.normalizedName),
    foreignKey({
      name: 'employees_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  ],
)

export const employeesRelations = relations(employees, ({ one }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
}))
