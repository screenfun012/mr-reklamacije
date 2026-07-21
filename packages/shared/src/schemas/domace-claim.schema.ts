import { z } from 'zod'

import { ClaimKind, ClaimOutcome } from '../enums.js'
import { ClaimFaultInputSchema, ClaimFaultItemSchema } from './claim-fault.schema.js'
import { FindingSchema } from './finding.schema.js'

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
    engineCode: z.string().trim().max(100).optional(),
    dateOfClaim: z.coerce.date().optional(),
    outcome: z.enum(claimOutcomeValues).default(ClaimOutcome.Pending),
    warrantyReport: z.string().trim().max(8000).optional(),
    employeeId: z.string().uuid().optional(),
    claimNumber: z.string().trim().max(50).optional(),
    dateOfFinish: z.coerce.date().optional(),
    totalAmount: z.number().nonnegative().optional(),
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
    engineCode: z.string().trim().max(100).nullable().optional(),
    dateOfClaim: z.coerce.date().nullable().optional(),
    warrantyReport: z.string().trim().max(8000).nullable().optional(),
    employeeId: z.string().uuid().nullable().optional(),
    claimNumber: z.string().trim().max(50).nullable().optional(),
    dateOfFinish: z.coerce.date().nullable().optional(),
    internalNotes: z.string().trim().max(8000).nullable().optional(),
    inspectionReport: z.string().trim().max(8000).nullable().optional(),
    faults: z.array(DomaceClaimFaultInputSchema).optional(),
    findings: z.array(FindingSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type DomaceClaimUpdateInput = z.infer<typeof DomaceClaimUpdateInputSchema>

/** Repair cost in EUR — only via PATCH /domace-claims/:id/amount on accepted claims. */
export const DomaceClaimAmountInputSchema = z.object({
  totalAmount: z.number().nonnegative().nullable(),
})

export type DomaceClaimAmountInput = z.infer<typeof DomaceClaimAmountInputSchema>

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
  createdAt: z.string(),
})

export type DomaceClaimListItem = z.infer<typeof DomaceClaimListItemSchema>

export const DomaceClaimDetailSchema = DomaceClaimListItemSchema.extend({
  engineTypeManufacturer: z.string().nullable(),
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
