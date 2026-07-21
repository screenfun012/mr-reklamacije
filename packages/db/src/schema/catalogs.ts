import type { ExternalPartyKind } from '@mr/shared'
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

import { customers } from './customers.js'

export const engineManufacturers = pgTable(
  'engine_manufacturers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [uniqueIndex('engine_manufacturers_code_key').on(t.code)],
)

export const engineTypes = pgTable(
  'engine_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    manufacturerId: uuid('manufacturer_id'),
    displacementCc: integer('displacement_cc'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    uniqueIndex('engine_types_code_key').on(t.code),
    index('idx_engine_types_manufacturer_id').on(t.manufacturerId),
    // Textually identical to the engine-type semi-join in claims.repository.ts.
    index('idx_engine_types_code_fts').using('gin', sql`to_tsvector('simple', ${t.code})`),
    foreignKey({
      name: 'engine_types_manufacturer_id_fkey',
      columns: [t.manufacturerId],
      foreignColumns: [engineManufacturers.id],
    }).onDelete('restrict'),
  ],
)

export const engineManufacturersRelations = relations(engineManufacturers, ({ many }) => ({
  engineTypes: many(engineTypes),
}))

export const engineTypesRelations = relations(engineTypes, ({ one }) => ({
  manufacturer: one(engineManufacturers, {
    fields: [engineTypes.manufacturerId],
    references: [engineManufacturers.id],
  }),
}))

export const externalParties = pgTable(
  'external_parties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    kind: text('kind').notNull().$type<ExternalPartyKind>(),
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
      'external_parties_kind_check',
      sql`${t.kind} IN ('supplier', 'subcontractor', 'manufacturer', 'other')`,
    ),
  ],
)

export const claimSources = pgTable(
  'claim_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    defaultCustomerId: uuid('default_customer_id'),
    claimNumberPrefix: text('claim_number_prefix'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    uniqueIndex('claim_sources_code_key').on(t.code),
    foreignKey({
      name: 'claim_sources_default_customer_id_fkey',
      columns: [t.defaultCustomerId],
      foreignColumns: [customers.id],
    }).onDelete('set null'),
  ],
)

export const claimSourcesRelations = relations(claimSources, ({ one }) => ({
  defaultCustomer: one(customers, {
    fields: [claimSources.defaultCustomerId],
    references: [customers.id],
  }),
}))
