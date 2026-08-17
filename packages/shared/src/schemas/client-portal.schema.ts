import { z } from 'zod'

import { ClaimKind, ClaimOutcome } from '../enums.js'
import { clientClaimPhaseValues } from './client-claim.schema.js'

const claimKindValues = [ClaimKind.Emotive, ClaimKind.Domace] as const

/**
 * One row of the portal "Recent activity" feed. A deliberate, minimal
 * projection of the audit trail: which claim, which phase it entered, when.
 * Never carries audit internals (actor, IP, before/after diffs).
 */
export const ClientPortalActivityItemSchema = z.object({
  kind: z.enum(claimKindValues),
  claimId: z.string().uuid(),
  mrNumber: z.string().nullable(),
  claimNumber: z.string().nullable(),
  event: z.enum(clientClaimPhaseValues),
  // Set only for `outcome` events so the feed can say "outcome available: Accepted".
  outcome: z.enum([ClaimOutcome.Accepted, ClaimOutcome.Rejected]).nullable(),
  occurredAt: z.string(),
})

export type ClientPortalActivityItem = z.infer<typeof ClientPortalActivityItemSchema>

/** Phase counts across ALL of the client's claims (not just the current page). */
export const ClientPortalStatsSchema = z.object({
  received: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})

export type ClientPortalStats = z.infer<typeof ClientPortalStatsSchema>

/**
 * Who the client calls. Resolved on the server from `app_settings`, because the portal bundle would
 * otherwise keep whatever was compiled into it while the same number in every email had changed.
 */
export const ClientPortalSupportSchema = z.object({
  phone: z.string(),
  email: z.string(),
})

export type ClientPortalSupport = z.infer<typeof ClientPortalSupportSchema>

export const ClientPortalSummarySchema = z.object({
  stats: ClientPortalStatsSchema,
  activity: z.array(ClientPortalActivityItemSchema),
  /**
   * Names of the firms the CALLING user is linked to (`customer_users`), so the
   * portal header stops guessing the company from the first claim — a client
   * with no claims yet would otherwise see their own personal name (docs/16 §5.1).
   * A list because one account may hold several links; the norm is one (§5.3).
   */
  firmNames: z.array(z.string()),
  support: ClientPortalSupportSchema,
})

export type ClientPortalSummary = z.infer<typeof ClientPortalSummarySchema>
