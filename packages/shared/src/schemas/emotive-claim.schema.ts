import { z } from 'zod'

import { ClaimOutcome, FaultType } from '../enums.js'

const claimOutcomeValues = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
  ClaimOutcome.Archived,
] as const

const faultTypeValues = [FaultType.Employee, FaultType.Department, FaultType.External] as const

const boolQueryParam = z
  .string()
  .optional()
  .transform((value: string | undefined) => value !== 'false')

export const EmotiveClaimFaultInputSchema = z.discriminatedUnion('faultType', [
  z.object({
    faultType: z.literal(FaultType.Employee),
    employeeId: z.string().uuid(),
    notes: z.string().trim().max(4000).optional(),
  }),
  z.object({
    faultType: z.literal(FaultType.Department),
    departmentId: z.string().uuid(),
    notes: z.string().trim().max(4000).optional(),
  }),
  z.object({
    faultType: z.literal(FaultType.External),
    externalPartyId: z.string().uuid(),
    notes: z.string().trim().max(4000).optional(),
  }),
])

export type EmotiveClaimFaultInput = z.infer<typeof EmotiveClaimFaultInputSchema>

export const EmotiveClaimCreateInputSchema = z.object({
  warrantyReport: z.string().trim().min(1).max(8000),
  engineTypeId: z.string().uuid(),
  dateOfClaim: z.coerce.date(),
  /** MR Engines internal work order (e.g. 5376/25). Required on create. */
  mrNumber: z.string().trim().min(1).max(50),
  employeeId: z.string().uuid(),
  sourceId: z.string().uuid(),
  outcome: z.enum(claimOutcomeValues).default(ClaimOutcome.Pending),
  claimNumber: z.string().trim().max(50).optional(),
  dateOfFinish: z.coerce.date().optional(),
  customerId: z.string().uuid().optional(),
  internalNotes: z.string().trim().max(8000).optional(),
  faults: z.array(EmotiveClaimFaultInputSchema).default([]),
})

export type EmotiveClaimCreateInput = z.infer<typeof EmotiveClaimCreateInputSchema>

export const EmotiveClaimUpdateInputSchema = z
  .object({
    warrantyReport: z.string().trim().min(1).max(8000).optional(),
    engineTypeId: z.string().uuid().optional(),
    dateOfClaim: z.coerce.date().optional(),
    mrNumber: z.string().trim().min(1).max(50).optional(),
    employeeId: z.string().uuid().optional(),
    sourceId: z.string().uuid().optional(),
    claimNumber: z.string().trim().max(50).nullable().optional(),
    dateOfFinish: z.coerce.date().nullable().optional(),
    customerId: z.string().uuid().nullable().optional(),
    internalNotes: z.string().trim().max(8000).nullable().optional(),
    faults: z.array(EmotiveClaimFaultInputSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type EmotiveClaimUpdateInput = z.infer<typeof EmotiveClaimUpdateInputSchema>

export const EmotiveClaimChangeOutcomeInputSchema = z.object({
  outcome: z.enum(claimOutcomeValues),
})

export type EmotiveClaimChangeOutcomeInput = z.infer<typeof EmotiveClaimChangeOutcomeInputSchema>

export const EmotiveClaimListQuerySchema = z.object({
  outcome: z.enum(claimOutcomeValues).optional(),
  sourceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
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

export type EmotiveClaimListQuery = z.infer<typeof EmotiveClaimListQuerySchema>

export const EmotiveClaimFaultItemSchema = z.object({
  id: z.string().uuid(),
  faultType: z.enum(faultTypeValues),
  employeeId: z.string().uuid().nullable(),
  departmentId: z.string().uuid().nullable(),
  externalPartyId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
})

export type EmotiveClaimFaultItem = z.infer<typeof EmotiveClaimFaultItemSchema>

export const EmotiveClaimListItemSchema = z.object({
  id: z.string().uuid(),
  sequenceNumber: z.number().int(),
  claimNumber: z.string().nullable(),
  warrantyReport: z.string(),
  engineTypeId: z.string().uuid(),
  engineTypeCode: z.string(),
  dateOfClaim: z.string(),
  mrNumber: z.string(),
  dateOfFinish: z.string().nullable(),
  employeeId: z.string().uuid(),
  employeeName: z.string(),
  sourceId: z.string().uuid(),
  outcome: z.enum(claimOutcomeValues),
  claimYear: z.number().int(),
  customerId: z.string().uuid().nullable(),
  customerName: z.string().nullable(),
  createdAt: z.string(),
})

export type EmotiveClaimListItem = z.infer<typeof EmotiveClaimListItemSchema>

export const EmotiveClaimDetailSchema = EmotiveClaimListItemSchema.extend({
  internalNotes: z.string().nullable(),
  updatedBy: z.string().uuid().nullable(),
  updatedAt: z.string(),
  faults: z.array(EmotiveClaimFaultItemSchema),
})

export type EmotiveClaimDetail = z.infer<typeof EmotiveClaimDetailSchema>

export interface EmotiveClaimListResponse {
  items: EmotiveClaimListItem[]
  total: number
  page: number
  pageSize: 10 | 25 | 50
}
