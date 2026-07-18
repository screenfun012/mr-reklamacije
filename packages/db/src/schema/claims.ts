import type { ClaimOutcome, FaultType } from '@mr/shared'
import { relations, sql } from 'drizzle-orm'
import {
  bigserial,
  check,
  date,
  decimal,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './access-control.js'
import { claimSources, engineManufacturers, engineTypes, externalParties } from './catalogs.js'
import { customers } from './customers.js'
import { departments, employees } from './employees.js'

/**
 * EMOTIVE (international) claims — replaces the `UKUPNO SA…` sheet.
 *
 * Full-text search uses the `simple` text search config (no stemming) so migrations
 * run on stock PostgreSQL 16 / Docker Alpine without Serbian dictionaries.
 */
export const emotiveClaims = pgTable(
  'emotive_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequenceNumber: bigserial('sequence_number', { mode: 'number' }).notNull().unique(),
    claimNumber: text('claim_number'),
    warrantyReport: text('warranty_report'),
    engineTypeId: uuid('engine_type_id').notNull(),
    manufacturerId: uuid('manufacturer_id'),
    engineCode: text('engine_code'),
    dateOfClaim: date('date_of_claim', { mode: 'date' }).notNull(),
    mrNumber: text('mr_number').notNull(),
    dateOfFinish: date('date_of_finish', { mode: 'date' }),
    employeeId: uuid('employee_id'),
    sourceId: uuid('source_id'),
    outcome: text('outcome').notNull().$type<ClaimOutcome>(),
    outcomeResolvedAt: timestamp('outcome_resolved_at', { withTimezone: true, mode: 'date' }),
    // claim_year is set by repository layer on INSERT/UPDATE
    // (year extracted from date_of_claim / date_received).
    // Docs mentions trigger but we enforce in application code for
    // testability and to avoid Drizzle limitation.
    claimYear: integer('claim_year').notNull(),
    customerId: uuid('customer_id'),
    internalNotes: text('internal_notes'),
    // Short worker-written English summary shown to the client on the portal
    // (distinct from internal_notes and the rich claim_reports document).
    inspectionReport: text('inspection_report'),
    clientVisibleAt: timestamp('client_visible_at', { withTimezone: true, mode: 'date' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    check(
      'emotive_claims_outcome_check',
      sql`${t.outcome} IN ('pending', 'accepted', 'rejected', 'archived')`,
    ),
    foreignKey({
      name: 'emotive_claims_engine_type_id_fkey',
      columns: [t.engineTypeId],
      foreignColumns: [engineTypes.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'emotive_claims_manufacturer_id_fkey',
      columns: [t.manufacturerId],
      foreignColumns: [engineManufacturers.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'emotive_claims_employee_id_fkey',
      columns: [t.employeeId],
      foreignColumns: [employees.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'emotive_claims_source_id_fkey',
      columns: [t.sourceId],
      foreignColumns: [claimSources.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'emotive_claims_customer_id_fkey',
      columns: [t.customerId],
      foreignColumns: [customers.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'emotive_claims_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'emotive_claims_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    index('idx_emotive_claims_date_of_claim').on(t.dateOfClaim.desc()),
    index('idx_emotive_claims_date_of_claim_id').on(t.dateOfClaim.desc(), t.id.desc()),
    index('idx_emotive_claims_claim_year_outcome').on(t.claimYear, t.outcome),
    index('idx_emotive_claims_outcome_resolved_at').on(t.outcomeResolvedAt.desc()),
    index('idx_emotive_claims_employee_id_claim_year').on(t.employeeId, t.claimYear),
    index('idx_emotive_claims_source_id').on(t.sourceId),
    index('idx_emotive_claims_customer_id').on(t.customerId),
    index('idx_emotive_claims_engine_type_id').on(t.engineTypeId),
    index('idx_emotive_claims_manufacturer_id').on(t.manufacturerId),
    index('idx_emotive_claims_manufacturer_id_claim_year').on(t.manufacturerId, t.claimYear),
    // Dashboard fetchRecent orders by created_at DESC; fetchChart range-filters it.
    index('idx_emotive_claims_created_at').on(t.createdAt.desc()),
    // TODO (Phase 1 optimization): Upgrade GIN full-text search to
    // Serbian stemmer. Requires installing Serbian dictionary
    // (e.g., snowball extension with Serbian rules) in Docker image
    // and/or production DB. Current 'simple' config works everywhere
    // but lacks stemming (tražim != tražu).
    // NOTE: this expression must stay TEXTUALLY identical to the search
    // predicates in emotive-claims.repository.ts and claims.repository.ts —
    // Postgres only uses an expression index when the expressions match.
    index('idx_emotive_claims_search_fts').using(
      'gin',
      sql`to_tsvector('simple', coalesce(${t.warrantyReport}, '') || ' ' || ${t.mrNumber})`,
    ),
  ],
)

export const emotiveClaimFaults = pgTable(
  'emotive_claim_faults',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    claimId: uuid('claim_id').notNull(),
    faultType: text('fault_type').notNull().$type<FaultType>(),
    employeeId: uuid('employee_id'),
    departmentId: uuid('department_id'),
    externalPartyId: uuid('external_party_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    check(
      'emotive_claim_faults_fault_type_check',
      sql`${t.faultType} IN ('employee', 'department', 'external')`,
    ),
    check(
      'emotive_claim_faults_one_of_check',
      sql`
        (${t.faultType} = 'employee' AND ${t.employeeId} IS NOT NULL
          AND ${t.departmentId} IS NULL AND ${t.externalPartyId} IS NULL)
        OR
        (${t.faultType} = 'department' AND ${t.employeeId} IS NULL
          AND ${t.departmentId} IS NOT NULL AND ${t.externalPartyId} IS NULL)
        OR
        (${t.faultType} = 'external' AND ${t.employeeId} IS NULL
          AND ${t.departmentId} IS NULL AND ${t.externalPartyId} IS NOT NULL)
      `,
    ),
    foreignKey({
      name: 'emotive_claim_faults_claim_id_fkey',
      columns: [t.claimId],
      foreignColumns: [emotiveClaims.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'emotive_claim_faults_employee_id_fkey',
      columns: [t.employeeId],
      foreignColumns: [employees.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'emotive_claim_faults_department_id_fkey',
      columns: [t.departmentId],
      foreignColumns: [departments.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'emotive_claim_faults_external_party_id_fkey',
      columns: [t.externalPartyId],
      foreignColumns: [externalParties.id],
    }).onDelete('restrict'),
    index('idx_emotive_claim_faults_claim_id').on(t.claimId),
    index('idx_emotive_claim_faults_employee_id').on(t.employeeId),
    index('idx_emotive_claim_faults_department_id').on(t.departmentId),
    // external-parties usage counts + ON DELETE restrict checks scan this FK.
    index('idx_emotive_claim_faults_external_party_id').on(t.externalPartyId),
  ],
)

/**
 * DOMACE (domestic) claims — mirrors the EMOTIVE claim shape (Phase 1.2a).
 *
 * Differences from EMOTIVE:
 *   - customer is free text (`customer_name`), not a customers FK
 *   - no `source_id` (domestic claims have no external claim sources)
 *   - retains `total_amount` for financial tracking
 *   - all business fields are nullable; the service enforces "at least one of
 *     {mr_number, customer_name}" via Zod. sequence_number, outcome, claim_year,
 *     and audit columns are always set server-side.
 *
 * sequence_number is a GLOBAL bigserial (same as EMOTIVE); the user-facing year
 * lives in mr_number. claim_year is set by the repository on INSERT/UPDATE
 * (year from date_of_claim, falling back to the current year).
 */
export const domaceClaims = pgTable(
  'domace_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequenceNumber: bigserial('sequence_number', { mode: 'number' }).notNull().unique(),
    claimNumber: text('claim_number'),
    customerName: text('customer_name'),
    warrantyReport: text('warranty_report'),
    engineTypeId: uuid('engine_type_id'),
    manufacturerId: uuid('manufacturer_id'),
    engineCode: text('engine_code'),
    dateOfClaim: date('date_of_claim', { mode: 'date' }),
    mrNumber: text('mr_number'),
    dateOfFinish: date('date_of_finish', { mode: 'date' }),
    employeeId: uuid('employee_id'),
    outcome: text('outcome').notNull().$type<ClaimOutcome>(),
    outcomeResolvedAt: timestamp('outcome_resolved_at', { withTimezone: true, mode: 'date' }),
    claimYear: integer('claim_year').notNull(),
    totalAmount: decimal('total_amount', { precision: 14, scale: 2, mode: 'number' }),
    internalNotes: text('internal_notes'),
    // Short worker-written English summary shown to the client on the portal
    // (distinct from internal_notes and the rich claim_reports document).
    inspectionReport: text('inspection_report'),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    check(
      'domace_claims_outcome_check',
      sql`${t.outcome} IN ('pending', 'accepted', 'rejected', 'archived')`,
    ),
    foreignKey({
      name: 'domace_claims_engine_type_id_fkey',
      columns: [t.engineTypeId],
      foreignColumns: [engineTypes.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'domace_claims_manufacturer_id_fkey',
      columns: [t.manufacturerId],
      foreignColumns: [engineManufacturers.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'domace_claims_employee_id_fkey',
      columns: [t.employeeId],
      foreignColumns: [employees.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'domace_claims_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'domace_claims_updated_by_fkey',
      columns: [t.updatedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    index('idx_domace_claims_date_of_claim').on(t.dateOfClaim.desc()),
    index('idx_domace_claims_date_of_claim_id').on(t.dateOfClaim.desc(), t.id.desc()),
    index('idx_domace_claims_claim_year_outcome').on(t.claimYear, t.outcome),
    index('idx_domace_claims_outcome_resolved_at').on(t.outcomeResolvedAt.desc()),
    index('idx_domace_claims_employee_id_claim_year').on(t.employeeId, t.claimYear),
    index('idx_domace_claims_engine_type_id').on(t.engineTypeId),
    index('idx_domace_claims_manufacturer_id').on(t.manufacturerId),
    index('idx_domace_claims_manufacturer_id_claim_year').on(t.manufacturerId, t.claimYear),
    // Dashboard fetchRecent orders by created_at DESC; fetchChart range-filters it.
    index('idx_domace_claims_created_at').on(t.createdAt.desc()),
    // Same `simple` FTS config as emotive_claims; Serbian stemmer TODO applies here too.
    // NOTE: expression must stay TEXTUALLY identical to the search predicates
    // in domace-claims.repository.ts and claims.repository.ts (index matching).
    index('idx_domace_claims_search_fts').using(
      'gin',
      sql`to_tsvector('simple', coalesce(${t.warrantyReport}, '') || ' ' || coalesce(${t.mrNumber}, '') || ' ' || coalesce(${t.customerName}, ''))`,
    ),
  ],
)

export const domaceClaimFaults = pgTable(
  'domace_claim_faults',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    claimId: uuid('claim_id').notNull(),
    faultType: text('fault_type').notNull().$type<FaultType>(),
    employeeId: uuid('employee_id'),
    departmentId: uuid('department_id'),
    externalPartyId: uuid('external_party_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    check(
      'domace_claim_faults_fault_type_check',
      sql`${t.faultType} IN ('employee', 'department', 'external')`,
    ),
    check(
      'domace_claim_faults_one_of_check',
      sql`
        (${t.faultType} = 'employee' AND ${t.employeeId} IS NOT NULL
          AND ${t.departmentId} IS NULL AND ${t.externalPartyId} IS NULL)
        OR
        (${t.faultType} = 'department' AND ${t.employeeId} IS NULL
          AND ${t.departmentId} IS NOT NULL AND ${t.externalPartyId} IS NULL)
        OR
        (${t.faultType} = 'external' AND ${t.employeeId} IS NULL
          AND ${t.departmentId} IS NULL AND ${t.externalPartyId} IS NOT NULL)
      `,
    ),
    foreignKey({
      name: 'domace_claim_faults_claim_id_fkey',
      columns: [t.claimId],
      foreignColumns: [domaceClaims.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'domace_claim_faults_employee_id_fkey',
      columns: [t.employeeId],
      foreignColumns: [employees.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'domace_claim_faults_department_id_fkey',
      columns: [t.departmentId],
      foreignColumns: [departments.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'domace_claim_faults_external_party_id_fkey',
      columns: [t.externalPartyId],
      foreignColumns: [externalParties.id],
    }).onDelete('restrict'),
    index('idx_domace_claim_faults_claim_id').on(t.claimId),
    index('idx_domace_claim_faults_employee_id').on(t.employeeId),
    index('idx_domace_claim_faults_department_id').on(t.departmentId),
    // external-parties usage counts + ON DELETE restrict checks scan this FK.
    index('idx_domace_claim_faults_external_party_id').on(t.externalPartyId),
  ],
)

export const emotiveClaimsRelations = relations(emotiveClaims, ({ many, one }) => ({
  faults: many(emotiveClaimFaults),
  engineType: one(engineTypes, {
    fields: [emotiveClaims.engineTypeId],
    references: [engineTypes.id],
  }),
  manufacturer: one(engineManufacturers, {
    fields: [emotiveClaims.manufacturerId],
    references: [engineManufacturers.id],
  }),
  employee: one(employees, {
    fields: [emotiveClaims.employeeId],
    references: [employees.id],
  }),
  source: one(claimSources, {
    fields: [emotiveClaims.sourceId],
    references: [claimSources.id],
  }),
  customer: one(customers, {
    fields: [emotiveClaims.customerId],
    references: [customers.id],
  }),
  creator: one(users, {
    relationName: 'emotive_claims_created_by',
    fields: [emotiveClaims.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    relationName: 'emotive_claims_updated_by',
    fields: [emotiveClaims.updatedBy],
    references: [users.id],
  }),
}))

export const emotiveClaimFaultsRelations = relations(emotiveClaimFaults, ({ one }) => ({
  claim: one(emotiveClaims, {
    fields: [emotiveClaimFaults.claimId],
    references: [emotiveClaims.id],
  }),
  employee: one(employees, {
    fields: [emotiveClaimFaults.employeeId],
    references: [employees.id],
  }),
  department: one(departments, {
    fields: [emotiveClaimFaults.departmentId],
    references: [departments.id],
  }),
  externalParty: one(externalParties, {
    fields: [emotiveClaimFaults.externalPartyId],
    references: [externalParties.id],
  }),
}))

export const domaceClaimsRelations = relations(domaceClaims, ({ many, one }) => ({
  faults: many(domaceClaimFaults),
  engineType: one(engineTypes, {
    fields: [domaceClaims.engineTypeId],
    references: [engineTypes.id],
  }),
  manufacturer: one(engineManufacturers, {
    fields: [domaceClaims.manufacturerId],
    references: [engineManufacturers.id],
  }),
  employee: one(employees, {
    fields: [domaceClaims.employeeId],
    references: [employees.id],
  }),
  creator: one(users, {
    relationName: 'domace_claims_created_by',
    fields: [domaceClaims.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    relationName: 'domace_claims_updated_by',
    fields: [domaceClaims.updatedBy],
    references: [users.id],
  }),
}))

export const domaceClaimFaultsRelations = relations(domaceClaimFaults, ({ one }) => ({
  claim: one(domaceClaims, {
    fields: [domaceClaimFaults.claimId],
    references: [domaceClaims.id],
  }),
  employee: one(employees, {
    fields: [domaceClaimFaults.employeeId],
    references: [employees.id],
  }),
  department: one(departments, {
    fields: [domaceClaimFaults.departmentId],
    references: [departments.id],
  }),
  externalParty: one(externalParties, {
    fields: [domaceClaimFaults.externalPartyId],
    references: [externalParties.id],
  }),
}))
