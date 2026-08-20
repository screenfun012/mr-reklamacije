import { z } from 'zod'

import { claimFreshnessValues, ClaimKind, ClaimOutcome, ClientClaimPhase } from '../enums.js'
import type { ClaimListItem } from './claim-list.schema.js'
import type { DomaceClaimDetail } from './domace-claim.schema.js'
import { SectionFreshnessSchema, type EmotiveClaimDetail } from './emotive-claim.schema.js'

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
 * THE single source of truth for the portal's live claim status.
 *
 * SUPERSEDED (2026-07-04 note below kept for history): status is no longer a
 * pure function of `outcome` alone. Phase 2 "client visibility" (EMOTIVE only)
 * gives a claim a private→published lifecycle — `clientVisibleAt`/`publishedAt`
 * now gate what the portal is told: while `publishedAt` is null the real
 * outcome must never leave the server, so phase is derived from the
 * visibility timestamps first, and only falls back to mirroring `outcome`
 * once the claim is published.
 *
 * - `publishedAt === null` (private): `clientVisibleAt === null` → Received
 *   (Primljeno); otherwise → InProgress (U obradi) — the real outcome is
 *   masked regardless of what it actually is.
 * - `publishedAt !== null` (published): mirrors the internal outcome exactly
 *   as before — `Pending` → InProgress, any resolved outcome → Outcome.
 *
 * Old note (2026-07-04): "The portal mirrors the internal outcome directly —
 * every pending claim reads 'in progress' ... Because status is a pure
 * function of `outcome` ... there is no separate `progressPhase` wire field."
 * That pure-function claim is now superseded by the visibility gate above;
 * the "no redundant wire field" property still holds — `clientPhase` is
 * computed once here, server-side, and shipped on the wire instead.
 */
export function deriveClientClaimPhase(
  outcome: ClaimOutcome,
  visibility: { clientVisibleAt: string | null; publishedAt: string | null },
): ClientClaimPhase {
  if (visibility.publishedAt === null) {
    return visibility.clientVisibleAt === null
      ? ClientClaimPhase.Received
      : ClientClaimPhase.InProgress
  }
  return outcome === ClaimOutcome.Pending ? ClientClaimPhase.InProgress : ClientClaimPhase.Outcome
}

/**
 * Phase 2 "client visibility" is EMOTIVE-only (DOMACE has no portal and no
 * `clientVisibleAt`/`publishedAt` columns — see the design doc's global
 * constraint). A DOMACE item is therefore treated as always-published so its
 * behavior through `toClientClaimListItem`/`toClientClaimDetail` is unchanged.
 */
function visibilityOf(item: ClaimListItem): {
  clientVisibleAt: string | null
  publishedAt: string | null
} {
  if (item.kind !== ClaimKind.Emotive) {
    return { clientVisibleAt: item.createdAt, publishedAt: item.createdAt }
  }
  return { clientVisibleAt: item.clientVisibleAt, publishedAt: item.publishedAt }
}

/**
 * Client-facing claim shapes — a strict WHITELIST. Only fields explicitly listed
 * here are ever sent to a `client`-role user. This is deliberately a whitelist
 * (not a blacklist): any new internal field added to the full claim schemas will
 * NOT leak to clients unless someone consciously adds it here.
 *
 * Excluded on purpose: employeeId/employeeName (handler), faults (krivica /
 * fault attribution), findings and the legacy internalNotes they replaced (both
 * an internal document), sourceId/sourceCode, updatedBy/updatedAt,
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
  clientPhase: z.enum(clientClaimPhaseValues),
  freshness: z.enum(claimFreshnessValues).nullable(),
  /**
   * The category CODE, not its id and not its name: the id is an internal UUID this whitelist
   * keeps out, and the name is catalogue text written in Serbian — the portal defaults to
   * English and labels the two categories it has tabs for with its own translated strings.
   */
  categoryCode: z.string().nullable(),
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
  sectionFreshness: SectionFreshnessSchema,
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
  const visibility = visibilityOf(item)
  const published = visibility.publishedAt !== null

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
    dateOfFinish: published ? item.dateOfFinish : null,
    outcome: published ? item.outcome : ClaimOutcome.Pending,
    claimYear: item.claimYear,
    customerName: item.customerName,
    createdAt: item.createdAt,
    clientPhase: deriveClientClaimPhase(item.outcome, visibility),
    // DOMACE never reaches a client (no portal, no per-user view tracking) —
    // narrow on kind so it keeps TS total instead of reading a field that
    // doesn't exist on DomaceClaimListItem.
    freshness: item.kind === ClaimKind.Emotive ? item.freshness : null,
    categoryCode: item.category?.code ?? null,
  }
}

// DOMACE has no portal and no per-client-user view tracking (mirrors the
// `freshness` narrowing above) — a DOMACE detail always reports all-false.
const NO_SECTION_FRESHNESS = {
  photos: false,
  inspection: false,
  details: false,
  outcome: false,
} as const

/** Whitelist a full claim detail down to the client-safe shape (no faults/notes/employee ids). */
export function toClientClaimDetail(
  detail: EmotiveClaimDetail | DomaceClaimDetail,
): ClientClaimDetail {
  return {
    ...toClientClaimListItem(detail),
    engineTypeManufacturer: detail.engineTypeManufacturer,
    inspectionReport: detail.inspectionReport,
    employeeName: detail.employeeName,
    sectionFreshness:
      detail.kind === ClaimKind.Emotive ? detail.sectionFreshness : NO_SECTION_FRESHNESS,
  }
}
