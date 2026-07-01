import { z } from 'zod'

import { ClaimKind, ClaimOutcome } from '../enums.js'
import type { ClaimListItem } from './claim-list.schema.js'
import type { DomaceClaimDetail } from './domace-claim.schema.js'
import type { EmotiveClaimDetail } from './emotive-claim.schema.js'

const claimOutcomeValues = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
  ClaimOutcome.Archived,
] as const

const claimKindValues = [ClaimKind.Emotive, ClaimKind.Domace] as const

/**
 * Client-facing claim shapes — a strict WHITELIST. Only fields explicitly listed
 * here are ever sent to a `client`-role user. This is deliberately a whitelist
 * (not a blacklist): any new internal field added to the full claim schemas will
 * NOT leak to clients unless someone consciously adds it here.
 *
 * Excluded on purpose: employeeId/employeeName (handler), faults (krivica /
 * fault attribution), internalNotes, sourceId/sourceCode, updatedBy/updatedAt,
 * totalAmount (pricing), and all internal UUIDs.
 */
export const ClientClaimListItemSchema = z.object({
  kind: z.enum(claimKindValues),
  id: z.string().uuid(),
  claimNumber: z.string().nullable(),
  mrNumber: z.string().nullable(),
  warrantyReport: z.string().nullable(),
  engineTypeCode: z.string().nullable(),
  manufacturerName: z.string().nullable(),
  engineCode: z.string().nullable(),
  dateOfClaim: z.string().nullable(),
  dateOfFinish: z.string().nullable(),
  outcome: z.enum(claimOutcomeValues),
  claimYear: z.coerce.number().int(),
  customerName: z.string().nullable(),
  createdAt: z.string(),
})

export type ClientClaimListItem = z.infer<typeof ClientClaimListItemSchema>

export const ClientClaimDetailSchema = ClientClaimListItemSchema.extend({
  engineTypeManufacturer: z.string().nullable(),
})

export type ClientClaimDetail = z.infer<typeof ClientClaimDetailSchema>

export const ClientClaimListResponseSchema = z.object({
  items: z.array(ClientClaimListItemSchema),
  total: z.coerce.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]),
})

export type ClientClaimListResponse = z.infer<typeof ClientClaimListResponseSchema>

/** Whitelist a full claim list item down to the client-safe shape. */
export function toClientClaimListItem(item: ClaimListItem): ClientClaimListItem {
  return {
    kind: item.kind,
    id: item.id,
    claimNumber: item.claimNumber,
    mrNumber: item.mrNumber ?? null,
    warrantyReport: item.warrantyReport,
    engineTypeCode: item.engineTypeCode ?? null,
    manufacturerName: item.manufacturerName,
    engineCode: item.engineCode,
    dateOfClaim: item.dateOfClaim ?? null,
    dateOfFinish: item.dateOfFinish,
    outcome: item.outcome,
    claimYear: item.claimYear,
    customerName: item.customerName,
    createdAt: item.createdAt,
  }
}

/** Whitelist a full claim detail down to the client-safe shape (no faults/employee/notes). */
export function toClientClaimDetail(
  detail: EmotiveClaimDetail | DomaceClaimDetail,
): ClientClaimDetail {
  return {
    ...toClientClaimListItem(detail),
    engineTypeManufacturer: detail.engineTypeManufacturer,
  }
}
