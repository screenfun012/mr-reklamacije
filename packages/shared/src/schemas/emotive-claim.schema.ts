import { z } from 'zod'

import { claimFreshnessValues, ClaimKind, ClaimOutcome } from '../enums.js'
import { ClaimFaultInputSchema, ClaimFaultItemSchema } from './claim-fault.schema.js'
import { FindingSchema } from './finding.schema.js'
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

export const EmotiveClaimFaultInputSchema = ClaimFaultInputSchema

export type EmotiveClaimFaultInput = z.infer<typeof EmotiveClaimFaultInputSchema>

export const EmotiveClaimCreateInputSchema = z.object({
  engineTypeId: z.string().uuid(),
  manufacturerId: z.string().uuid().optional(),
  // What kind of work the claim is about (spec §3.3) — required on create AND update so a
  // claim can never leave the edit uncategorised. NULL-able in the DB (Task 1 backfill), not here.
  categoryId: z.string().uuid(),
  dateOfClaim: z.coerce.date(),
  /** MR Engines internal work order (e.g. 5376/25). Required on create. */
  mrNumber: z.string().trim().min(1).max(50),
  outcome: z.enum(claimOutcomeValues).default(ClaimOutcome.Pending),
  warrantyReport: z.string().trim().max(8000).optional(),
  engineCode: z.string().trim().max(100).optional(),
  employeeId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  claimNumber: z.string().trim().max(50).optional(),
  dateOfFinish: z.coerce.date().optional(),
  customerId: z.string().uuid().optional(),
  internalNotes: z.string().trim().max(8000).optional(),
  inspectionReport: z.string().trim().max(8000).optional(),
  faults: z.array(EmotiveClaimFaultInputSchema).default([]),
  findings: z.array(FindingSchema).default([]),
})

export type EmotiveClaimCreateInput = z.infer<typeof EmotiveClaimCreateInputSchema>

export const EmotiveClaimUpdateInputSchema = z
  .object({
    warrantyReport: z.string().trim().min(1).max(8000).optional(),
    engineTypeId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().nullable().optional(),
    // Required on update too, deliberately (spec §3.3): a claim being edited must not
    // leave the edit uncategorised. The Task 1 backfill means no existing claim is blocked.
    categoryId: z.string().uuid(),
    engineCode: z.string().trim().max(100).nullable().optional(),
    dateOfClaim: z.coerce.date().optional(),
    mrNumber: z.string().trim().min(1).max(50).optional(),
    employeeId: z.string().uuid().nullable().optional(),
    sourceId: z.string().uuid().optional(),
    claimNumber: z.string().trim().max(50).nullable().optional(),
    dateOfFinish: z.coerce.date().nullable().optional(),
    customerId: z.string().uuid().nullable().optional(),
    internalNotes: z.string().trim().max(8000).nullable().optional(),
    inspectionReport: z.string().trim().max(8000).nullable().optional(),
    faults: z.array(EmotiveClaimFaultInputSchema).optional(),
    findings: z.array(FindingSchema).optional(),
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

export type EmotiveClaimListQuery = z.infer<typeof EmotiveClaimListQuerySchema>

export const EmotiveClaimFaultItemSchema = ClaimFaultItemSchema

export type EmotiveClaimFaultItem = z.infer<typeof EmotiveClaimFaultItemSchema>

export const EmotiveClaimListItemSchema = z.object({
  kind: z.literal(ClaimKind.Emotive),
  id: z.string().uuid(),
  sequenceNumber: z.coerce.number().int(),
  claimNumber: z.string().nullable(),
  warrantyReport: z.string().nullable(),
  engineTypeId: z.string().uuid(),
  engineTypeCode: z.string(),
  manufacturerId: z.string().uuid().nullable(),
  manufacturerName: z.string().nullable(),
  engineCode: z.string().nullable(),
  dateOfClaim: z.string(),
  mrNumber: z.string(),
  dateOfFinish: z.string().nullable(),
  employeeId: z.string().uuid().nullable(),
  employeeName: z.string().nullable(),
  sourceId: z.string().uuid().nullable(),
  outcome: z.enum(claimOutcomeValues),
  claimYear: z.coerce.number().int(),
  customerId: z.string().uuid().nullable(),
  customerName: z.string().nullable(),
  // The kind of work the claim is about, resolved from `categoryId` (Faza 1, spec §3.3).
  // On the LIST as well as the detail: the list has a Kategorija column and filters by it.
  // `null` only for a legacy row outside this feature's write paths. The category is data —
  // nothing in any layer may branch on `code`.
  category: ClaimCategoryRefSchema.nullable(),
  createdAt: z.string(),
  /**
   * Client-visibility lifecycle timestamps (Phase 2, EMOTIVE only) — INTERNAL,
   * full-view fields. They exist so the client projection (`toClientClaimListItem`
   * / `toClientClaimDetail` in `client-claim.schema.ts`) can derive `clientPhase`
   * and mask `outcome`/`dateOfFinish` while `publishedAt` is null. They must
   * NEVER be copied onto a client-facing wire shape.
   */
  clientVisibleAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  /**
   * Per-client-user NEW/UPDATE signal (Phase 3), computed server-side per
   * viewer against `emotive_claim_client_views`. `null` for internal/full-view
   * reads (there is no single "viewer") and whenever there's nothing to flag.
   */
  freshness: z.enum(claimFreshnessValues).nullable(),
})

export type EmotiveClaimListItem = z.infer<typeof EmotiveClaimListItemSchema>

/**
 * Phase 3.1 per-section NEW/UPDATE markers (detail-only — the list stays on
 * the single `freshness` badge above). Computed server-side per viewer against
 * `emotive_claim_client_views.viewed_at` vs. each key in `section_updated_at`;
 * all-false for internal/full-view reads (there is no single "viewer") and for
 * a still-private (Primljeno) claim. Raw timestamps never leave the server —
 * only these booleans.
 */
export const SectionFreshnessSchema = z.object({
  photos: z.boolean(),
  inspection: z.boolean(),
  details: z.boolean(),
  outcome: z.boolean(),
})

export type SectionFreshness = z.infer<typeof SectionFreshnessSchema>

export const EmotiveClaimDetailSchema = EmotiveClaimListItemSchema.extend({
  engineTypeManufacturer: z.string().nullable(),
  sourceCode: z.string().nullable(),
  sourceName: z.string().nullable(),
  internalNotes: z.string().nullable(),
  inspectionReport: z.string().nullable(),
  updatedBy: z.string().uuid().nullable(),
  updatedAt: z.string(),
  faults: z.array(EmotiveClaimFaultItemSchema),
  findings: z.array(FindingSchema).nullable(),
  sectionFreshness: SectionFreshnessSchema,
})

export type EmotiveClaimDetail = z.infer<typeof EmotiveClaimDetailSchema>

export interface EmotiveClaimListResponse {
  items: EmotiveClaimListItem[]
  total: number
  page: number
  pageSize: 10 | 25 | 50
}
