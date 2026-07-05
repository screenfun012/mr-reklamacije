import { z } from 'zod'

import { ClaimKind, ClaimOutcome, ClientClaimPhase } from '../enums.js'
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

export const clientClaimPhaseValues = [
  ClientClaimPhase.Received,
  ClientClaimPhase.InProgress,
  ClientClaimPhase.Outcome,
] as const

/**
 * THE single source of truth for the portal's live claim status. The portal
 * mirrors the internal outcome directly (Nikola, 2026-07-04): every pending
 * claim reads "in progress" — the same story the internal app tells — and a
 * resolved outcome is the Outcome phase. Because status is now a pure function
 * of `outcome` (which is already in the client whitelist), the server and the
 * portal both call THIS — there is no separate `progressPhase` wire field and
 * no second client-side derivation to drift out of sync. `Received` survives
 * only as the always-completed first step of the detail timeline and as an
 * activity-feed event type — never as a live status.
 */
export function deriveClientClaimPhase(outcome: ClaimOutcome): ClientClaimPhase {
  return outcome === ClaimOutcome.Pending ? ClientClaimPhase.InProgress : ClientClaimPhase.Outcome
}

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
  // Worker-written English summary intended for the client to read on screen.
  inspectionReport: z.string().nullable(),
  // Assigned technician's display name — deliberate whitelist extension approved
  // 2026-07-03 so the client knows who works on their engine. Name only; no
  // employee id, email or any other employee data.
  employeeName: z.string().nullable(),
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

/** Whitelist a full claim detail down to the client-safe shape (no faults/notes/employee ids). */
export function toClientClaimDetail(
  detail: EmotiveClaimDetail | DomaceClaimDetail,
): ClientClaimDetail {
  return {
    ...toClientClaimListItem(detail),
    engineTypeManufacturer: detail.engineTypeManufacturer,
    inspectionReport: detail.inspectionReport,
    employeeName: detail.employeeName,
  }
}
