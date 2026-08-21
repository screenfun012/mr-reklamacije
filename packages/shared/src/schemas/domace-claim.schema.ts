import { z } from 'zod'

import { ClaimKind, ClaimOutcome } from '../enums.js'
import { ClaimFaultInputSchema, ClaimFaultItemSchema } from './claim-fault.schema.js'
import { FindingSchema } from './finding.schema.js'
import { ClaimCategoryFieldValuesSchema } from './claim-category-field.schema.js'
import { ClaimCategoryRefSchema } from './reference-data.schema.js'

const claimOutcomeValues = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
  ClaimOutcome.Archived,
] as const

const boolQueryParam = z
  .string()
  .optional()
  .transform((value: string | undefined) => value !== 'false')

export const DomaceClaimFaultInputSchema = ClaimFaultInputSchema

export type DomaceClaimFaultInput = z.infer<typeof DomaceClaimFaultInputSchema>

/**
 * DOMACE claims mirror the EMOTIVE shape but every field is optional. The
 * business invariant is "at least one of mrNumber / customerName", enforced via
 * refine. `mrNumber` is free text (no MR prefix / year format imposed).
 */
export const DomaceClaimCreateInputSchema = z
  .object({
    mrNumber: z.string().trim().min(1).max(50).optional(),
    customerName: z.string().trim().min(1).max(255).optional(),
    engineTypeId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    // What kind of work the claim is about (spec §3.3) — required on create AND update so a
    // claim can never leave the edit uncategorised. NULL-able in the DB (Task 1 backfill), not here.
    categoryId: z.string().uuid(),
    /**
     * Answers to the fields that category owns; the server checks them against the catalogue.
     * Optional, not defaulted: a claim with no answers stores NULL, and "no value" is not the
     * same statement as "an empty set of answers" (the migration test pins that difference).
     */
    categoryFieldValues: ClaimCategoryFieldValuesSchema.optional(),
    engineCode: z.string().trim().max(100).optional(),
    dateOfClaim: z.coerce.date().optional(),
    outcome: z.enum(claimOutcomeValues).default(ClaimOutcome.Pending),
    warrantyReport: z.string().trim().max(8000).optional(),
    employeeId: z.string().uuid().optional(),
    claimNumber: z.string().trim().max(50).optional(),
    invoiceNumber: z.string().trim().max(50).optional(),
    dateOfFinish: z.coerce.date().optional(),
    // Money breakdown (docs/23) — editable in any outcome state. total_amount
    // (UKUPNO) is NOT an input; it is computed = parts + labor on write.
    originalInvoiceAmount: z.number().nonnegative().optional(),
    partsAmount: z.number().nonnegative().optional(),
    laborAmount: z.number().nonnegative().optional(),
    internalNotes: z.string().trim().max(8000).optional(),
    inspectionReport: z.string().trim().max(8000).optional(),
    faults: z.array(DomaceClaimFaultInputSchema).default([]),
    findings: z.array(FindingSchema).default([]),
  })
  .refine((value) => Boolean(value.mrNumber) || Boolean(value.customerName), {
    message: 'At least one of mrNumber or customerName must be provided',
    path: ['mrNumber'],
  })

export type DomaceClaimCreateInput = z.infer<typeof DomaceClaimCreateInputSchema>

export const DomaceClaimUpdateInputSchema = z
  .object({
    mrNumber: z.string().trim().max(50).nullable().optional(),
    customerName: z.string().trim().max(255).nullable().optional(),
    engineTypeId: z.string().uuid().nullable().optional(),
    manufacturerId: z.string().uuid().nullable().optional(),
    /**
     * OPTIONAL on update, unlike on create. Every editor on the claim screen PATCHes its own
     * slice — the inspection report alone (which is Gate A), the faults alone, the findings
     * alone — so demanding the category on every PATCH turned all three into a 400. And it
     * bought nothing: the field is not nullable here, so an absent key can only mean "leave
     * the category as it is", never "clear it". A claim still cannot BECOME uncategorised —
     * create demands one, and the basic-fields editor always sends it.
     */
    categoryId: z.string().uuid().optional(),
    /** Absent = leave the answers as they are; the category's own change clears them. */
    categoryFieldValues: ClaimCategoryFieldValuesSchema.optional(),
    engineCode: z.string().trim().max(100).nullable().optional(),
    dateOfClaim: z.coerce.date().nullable().optional(),
    warrantyReport: z.string().trim().max(8000).nullable().optional(),
    employeeId: z.string().uuid().nullable().optional(),
    claimNumber: z.string().trim().max(50).nullable().optional(),
    invoiceNumber: z.string().trim().max(50).nullable().optional(),
    dateOfFinish: z.coerce.date().nullable().optional(),
    originalInvoiceAmount: z.number().nonnegative().nullable().optional(),
    partsAmount: z.number().nonnegative().nullable().optional(),
    laborAmount: z.number().nonnegative().nullable().optional(),
    internalNotes: z.string().trim().max(8000).nullable().optional(),
    inspectionReport: z.string().trim().max(8000).nullable().optional(),
    faults: z.array(DomaceClaimFaultInputSchema).optional(),
    findings: z.array(FindingSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type DomaceClaimUpdateInput = z.infer<typeof DomaceClaimUpdateInputSchema>

export const DomaceClaimChangeOutcomeInputSchema = z.object({
  outcome: z.enum(claimOutcomeValues),
})

export type DomaceClaimChangeOutcomeInput = z.infer<typeof DomaceClaimChangeOutcomeInputSchema>

export const DomaceClaimListQuerySchema = z.object({
  outcome: z.enum(claimOutcomeValues).optional(),
  manufacturerId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().min(1).optional(),
  includeDeleted: boolQueryParam.default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
    .default(10),
})

export type DomaceClaimListQuery = z.infer<typeof DomaceClaimListQuerySchema>

export const DomaceClaimFaultItemSchema = ClaimFaultItemSchema

export type DomaceClaimFaultItem = z.infer<typeof DomaceClaimFaultItemSchema>

export const DomaceClaimListItemSchema = z.object({
  kind: z.literal(ClaimKind.Domace),
  id: z.string().uuid(),
  sequenceNumber: z.coerce.number().int(),
  claimNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  warrantyReport: z.string().nullable(),
  engineTypeId: z.string().uuid().nullable(),
  engineTypeCode: z.string().nullable(),
  manufacturerId: z.string().uuid().nullable(),
  manufacturerName: z.string().nullable(),
  engineCode: z.string().nullable(),
  dateOfClaim: z.string().nullable(),
  mrNumber: z.string().nullable(),
  dateOfFinish: z.string().nullable(),
  employeeId: z.string().uuid().nullable(),
  employeeName: z.string().nullable(),
  outcome: z.enum(claimOutcomeValues),
  claimYear: z.coerce.number().int(),
  totalAmount: z.coerce.number().nullable(),
  // See the EMOTIVE list item: the category rides the list, not only the detail.
  category: ClaimCategoryRefSchema.nullable(),
  createdAt: z.string(),
})

export type DomaceClaimListItem = z.infer<typeof DomaceClaimListItemSchema>

export const DomaceClaimDetailSchema = DomaceClaimListItemSchema.extend({
  engineTypeManufacturer: z.string().nullable(),
  categoryFieldValues: ClaimCategoryFieldValuesSchema,
  invoiceNumber: z.string().nullable(),
  originalInvoiceAmount: z.coerce.number().nullable(),
  partsAmount: z.coerce.number().nullable(),
  laborAmount: z.coerce.number().nullable(),
  internalNotes: z.string().nullable(),
  inspectionReport: z.string().nullable(),
  updatedBy: z.string().uuid().nullable(),
  updatedAt: z.string(),
  faults: z.array(DomaceClaimFaultItemSchema),
  findings: z.array(FindingSchema).nullable(),
})

export type DomaceClaimDetail = z.infer<typeof DomaceClaimDetailSchema>

export interface DomaceClaimListResponse {
  items: DomaceClaimListItem[]
  total: number
  page: number
  pageSize: 10 | 25 | 50
}
