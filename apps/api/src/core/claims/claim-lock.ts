import { ClaimOutcome } from '@mr/shared'

import { ConflictError } from '../errors/domain-errors.js'

/**
 * Repair cost (`total_amount`) is recorded only after a claim is accepted.
 * Unlike general edits, amount updates are allowed on accepted (locked) claims
 * via a dedicated endpoint — see DOMACE `updateAmount`.
 */
export function assertAcceptedClaimAmountEditable(claim: { outcome: ClaimOutcome }): void {
  if (claim.outcome !== ClaimOutcome.Accepted) {
    throw new ConflictError('Repair amount can only be set on accepted claims')
  }
}
