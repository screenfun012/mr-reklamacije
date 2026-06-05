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
import { claimSources, engineTypes, externalParties } from './catalogs.js'
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
    warrantyReport: text('warranty_report').notNull(),
    engineTypeId: uuid('engine_type_id').notNull(),
    dateOfClaim: date('date_of_claim', { mode: 'date' }).notNull(),
    mrNumber: text('mr_number').notNull(),
    dateOfFinish: date('date_of_finish', { mode: 'date' }),
    employeeId: uuid('employee_id').notNull(),
    sourceId: uuid('source_id').notNull(),
    outcome: text('outcome').notNull().$type<ClaimOutcome>(),
    // claim_year is set by repository layer on INSERT/UPDATE
    // (year extracted from date_of_claim / date_received).
    // Docs mentions trigger but we enforce in application code for
    // testability and to avoid Drizzle limitation.
    claimYear: integer('claim_year').notNull(),
    customerId: uuid('customer_id'),
    internalNotes: text('internal_notes'),
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
    index('idx_emotive_claims_employee_id_claim_year').on(t.employeeId, t.claimYear),
    index('idx_emotive_claims_source_id').on(t.sourceId),
    index('idx_emotive_claims_customer_id').on(t.customerId),
    index('idx_emotive_claims_engine_type_id').on(t.engineTypeId),
    // TODO (Phase 1 optimization): Upgrade GIN full-text search to
    // Serbian stemmer. Requires installing Serbian dictionary
    // (e.g., snowball extension with Serbian rules) in Docker image
    // and/or production DB. Current 'simple' config works everywhere
    // but lacks stemming (tražim != tražu).
    index('idx_emotive_claims_warranty_report_fts').using(
      'gin',
      sql`to_tsvector('simple', ${t.warrantyReport})`,
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
  ],
)

/**
 * Domestic market claims — unifies pre-2026 and 2026+ Excel formats.
 * sequence_number_yearly and claim_year are set in repository (transaction + FOR UPDATE), not triggers.
 */
export const domaceClaims = pgTable(
  'domace_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequenceNumberYearly: integer('sequence_number_yearly').notNull(),
    dateReceived: date('date_received', { mode: 'date' }).notNull(),
    customerId: uuid('customer_id'),
    customerNameSnapshot: text('customer_name_snapshot').notNull(),
    vehicle: text('vehicle').notNull(),
    workOrder: text('work_order').notNull(),
    oldWorkOrder: text('old_work_order'),
    originalInvoiceAmount: decimal('original_invoice_amount', {
      precision: 14,
      scale: 2,
      mode: 'number',
    }),
    invoiceNumber: text('invoice_number'),
    problemDescription: text('problem_description').notNull(),
    outcome: text('outcome').notNull().$type<ClaimOutcome>(),
    partsAmountNoVat: decimal('parts_amount_no_vat', { precision: 14, scale: 2, mode: 'number' }),
    laborAmountNoVat: decimal('labor_amount_no_vat', { precision: 14, scale: 2, mode: 'number' }),
    totalAmount: decimal('total_amount', { precision: 14, scale: 2, mode: 'number' }),
    assignedEmployeeId: uuid('assigned_employee_id'),
    faultDepartmentId: uuid('fault_department_id'),
    notes: text('notes'),
    internalNotes: text('internal_notes'),
    // claim_year: same application-layer rule as emotive_claims (year from date_received).
    claimYear: integer('claim_year').notNull(),
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
      name: 'domace_claims_customer_id_fkey',
      columns: [t.customerId],
      foreignColumns: [customers.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'domace_claims_assigned_employee_id_fkey',
      columns: [t.assignedEmployeeId],
      foreignColumns: [employees.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'domace_claims_fault_department_id_fkey',
      columns: [t.faultDepartmentId],
      foreignColumns: [departments.id],
    }).onDelete('set null'),
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
    index('idx_domace_claims_date_received').on(t.dateReceived.desc()),
    index('idx_domace_claims_claim_year_outcome').on(t.claimYear, t.outcome),
    index('idx_domace_claims_customer_id').on(t.customerId),
    index('idx_domace_claims_assigned_employee_claim_year').on(t.assignedEmployeeId, t.claimYear),
    index('idx_domace_claims_fault_department_claim_year').on(t.faultDepartmentId, t.claimYear),
    // Same `simple` FTS config as emotive_claims; Serbian stemmer TODO applies here too.
    index('idx_domace_claims_problem_customer_fts').using(
      'gin',
      sql`to_tsvector('simple', coalesce(${t.problemDescription}, '') || ' ' || coalesce(${t.customerNameSnapshot}, ''))`,
    ),
  ],
)

export const emotiveClaimsRelations = relations(emotiveClaims, ({ many, one }) => ({
  faults: many(emotiveClaimFaults),
  engineType: one(engineTypes, {
    fields: [emotiveClaims.engineTypeId],
    references: [engineTypes.id],
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

export const domaceClaimsRelations = relations(domaceClaims, ({ one }) => ({
  customer: one(customers, {
    fields: [domaceClaims.customerId],
    references: [customers.id],
  }),
  assignedEmployee: one(employees, {
    relationName: 'domace_claims_assigned_employee',
    fields: [domaceClaims.assignedEmployeeId],
    references: [employees.id],
  }),
  faultDepartment: one(departments, {
    relationName: 'domace_claims_fault_department',
    fields: [domaceClaims.faultDepartmentId],
    references: [departments.id],
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
