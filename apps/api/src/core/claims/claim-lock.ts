import { ClaimOutcome } from '@mr/shared'

import { ConflictError, ForbiddenError } from '../errors/domain-errors.js'

/**
 * Reopen authorization context for a claim module. Each module owns its own
 * reopen permission code (e.g. `emotive_claims.reopen`, `domace_claims.reopen`)
 * but the locking rules are identical.
 */
export interface ClaimReopenAuth {
  /** Permission code that authorizes reopening a completed claim (admin-held). */
  reopenPermission: string
  /** Permissions carried by the acting user. */
  permissions: readonly string[]
}

/**
 * The single editability wall, shared by every claim module (EMOTIVE, DOMACE).
 * A claim is editable only while `pending`; once accepted/rejected it is locked
 * until a reopen-permission holder reopens it. Every content mutation (fields,
 * faults, later attachments) must pass through here.
 */
export function assertClaimEditable(claim: { outcome: ClaimOutcome }): void {
  if (claim.outcome !== ClaimOutcome.Pending) {
    throw new ConflictError('Claim is locked; reopen it before editing')
  }
}

/**
 * Authorizes an outcome transition and reports whether it is a reopen.
 * - pending → accepted/rejected: allowed (route already enforces change_outcome)
 * - accepted/rejected → pending (reopen): requires the module reopen permission
 * - accepted/rejected → accepted/rejected (direct): blocked; reopen first
 */
export function assertOutcomeTransitionAllowed(
  from: ClaimOutcome,
  to: ClaimOutcome,
  auth: ClaimReopenAuth,
): boolean {
  if (from === ClaimOutcome.Pending) {
    return false
  }

  if (to === ClaimOutcome.Pending) {
    if (!auth.permissions.includes(auth.reopenPermission)) {
      throw new ForbiddenError('Reopening a completed claim requires reopen permission')
    }
    return true
  }

  throw new ConflictError('Claim is locked; reopen it before changing the outcome')
}

/**
 * Guards a drastic action (e.g. delete) on a completed claim: only the
 * reopen-permission holder may perform it. Pending claims pass through.
 */
export function assertCompletedActionAllowed(
  claim: { outcome: ClaimOutcome },
  auth: ClaimReopenAuth,
  message: string,
): void {
  if (claim.outcome !== ClaimOutcome.Pending && !auth.permissions.includes(auth.reopenPermission)) {
    throw new ForbiddenError(message)
  }
}
