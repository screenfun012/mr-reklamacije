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

/**
 * The vehicle-intake lists the shop owns (docs/25 §3.0.2, Nikola 2026-08-10). They were hardcoded
 * in `@mr/shared` until then, which meant a new checklist item or a fifth kind of damage was a code
 * change — and the admin app, which `docs/13` makes the control plane for exactly this, had nothing
 * for the service module at all.
 *
 * Same shape as `departments`, deliberately: `code` is the stable key an intake order stores, and
 * the two NAME columns exist because the printed work order is bilingual (V-7 decision ⑪) — a
 * catalog with only a Serbian name prints Serbian onto an English document.
 *
 * The order keeps storing the CODE, never the name, so renaming an item is retroactive by design
 * (decision ⑫): a typo fixed here is fixed on every screen and every reprint at once.
 */
export const intakeChecklistItems = pgTable(
  'intake_checklist_items',
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
  (t) => [uniqueIndex('intake_checklist_items_code_key').on(t.code)],
)

export const intakeDamageTypes = pgTable(
  'intake_damage_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    nameSr: text('name_sr').notNull(),
    nameEn: text('name_en').notNull(),
    /**
     * Which BRAND TONE the marker is drawn in — never a raw colour. The house rule is that colours
     * come from the `mri-*` tokens and nowhere else (CLAUDE.md §5), and there is a second reason
     * here: amber carries a different value in the light theme than in the dark one, so a stored
     * hex would look wrong in one of them. The screen maps the tone to its token.
     *
     * SCREEN ONLY: the printed sheet draws every marker in brand red whatever the tone, because
     * amber and grey do not print legibly (V-7).
     */
    markerTone: text('marker_tone').notNull().default('red'),
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
    uniqueIndex('intake_damage_types_code_key').on(t.code),
    // Only the four tones that exist as RUNTIME variables in `:root`. The status hues
    // (`warn`/`ok`/`bad`/`info`) live only inside `@theme inline`, so a `var()` on them resolves to
    // nothing and silently drops `fill` — which is exactly how the fuel dial's amber arc was
    // invisible from the day it was drawn (CLAUDE.md §5).
    check(
      'intake_damage_types_marker_tone_check',
      sql`${t.markerTone} IN ('red', 'amber', 'grey', 'green')`,
    ),
  ],
)

export const intakeArrivalModes = pgTable(
  'intake_arrival_modes',
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
  (t) => [uniqueIndex('intake_arrival_modes_code_key').on(t.code)],
)

/**
 * What kind of work the claim is about: general overhaul, machining, new parts, car service.
 *
 * A catalog rather than an enum on purpose (spec §10.3): a fifth category is a row Nikola adds
 * from the admin panel, with no deploy and no migration. Nothing in the code may branch on a
 * value in this table.
 */
export const claimCategories = pgTable(
  'claim_categories',
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
  (t) => [uniqueIndex('claim_categories_code_key').on(t.code)],
)
