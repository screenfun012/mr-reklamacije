import { ClaimOutcome } from '@mr/shared'

/**
 * Computes `outcome_resolved_at` for an outcome transition.
 * Returns `undefined` when the column should not change (e.g. pending → archived).
 */
export function outcomeResolvedAtForTransition(
  from: ClaimOutcome,
  to: ClaimOutcome,
  resolvedAt: Date = new Date(),
): Date | null | undefined {
  if (to === ClaimOutcome.Pending) {
    return null
  }

  if (
    from === ClaimOutcome.Pending &&
    (to === ClaimOutcome.Accepted || to === ClaimOutcome.Rejected)
  ) {
    return resolvedAt
  }

  return undefined
}

export function initialOutcomeResolvedAt(
  outcome: ClaimOutcome,
  resolvedAt: Date = new Date(),
): Date | null {
  if (outcome === ClaimOutcome.Accepted || outcome === ClaimOutcome.Rejected) {
    return resolvedAt
  }

  return null
}
