import type { AppSettingValueType } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'
import { employees } from './employees.js'

/**
 * Admin key-value settings (serialized values). value NULL means cleared without deleting the row.
 */
export const appSettings = pgTable(
  'app_settings',
  {
    key: text('key').primaryKey(),
    value: text('value'),
    valueType: text('value_type').notNull().$type<AppSettingValueType>(),
    isSecret: boolean('is_secret').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    updatedBy: uuid('updated_by'),
  },
  (t) => [
    check(
      'app_settings_value_type_check',
      sql`${t.valueType} IN ('string', 'number', 'boolean', 'json')`,
    ),
    foreignKey({
      name: 'app_settings_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  ],
)

/**
 * Manually entered monthly engine assembly counts per employee (reklamacije / sklopljeno).
 */
export const employeeMonthlyOutput = pgTable(
  'employee_monthly_output',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id').notNull(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    enginesAssembled: integer('engines_assembled').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by'),
  },
  (t) => [
    check('employee_monthly_output_month_check', sql`${t.month} >= 1 AND ${t.month} <= 12`),
    uniqueIndex('employee_monthly_output_employee_id_year_month_key').on(
      t.employeeId,
      t.year,
      t.month,
    ),
    foreignKey({
      name: 'employee_monthly_output_employee_id_fkey',
      columns: [t.employeeId],
      foreignColumns: [employees.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'employee_monthly_output_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'employee_monthly_output_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    index('idx_employee_monthly_output_employee_year_month').on(
      t.employeeId,
      t.year,
      t.month.desc(),
    ),
    index('idx_employee_monthly_output_year_month').on(t.year, t.month),
  ],
)

export const appSettingsRelations = relations(appSettings, ({ one }) => ({
  updater: one(users, {
    fields: [appSettings.updatedBy],
    references: [users.id],
  }),
}))

export const employeeMonthlyOutputRelations = relations(employeeMonthlyOutput, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeMonthlyOutput.employeeId],
    references: [employees.id],
  }),
  creator: one(users, {
    relationName: 'employee_monthly_output_created_by',
    fields: [employeeMonthlyOutput.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    relationName: 'employee_monthly_output_updated_by',
    fields: [employeeMonthlyOutput.updatedBy],
    references: [users.id],
  }),
}))
