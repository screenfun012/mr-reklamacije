import { m } from '@mr/i18n'
import { ClaimOutcome, type ClaimOutcome as ClaimOutcomeType } from '@mr/shared'

import { InternalPill, type InternalPillTone } from '~/components/internal-pill'

const OUTCOME_TONES: Record<ClaimOutcomeType, InternalPillTone> = {
  [ClaimOutcome.Pending]: 'warn',
  [ClaimOutcome.Accepted]: 'ok',
  [ClaimOutcome.Rejected]: 'bad',
  [ClaimOutcome.Archived]: 'archived',
}

/** Exported for reuse wherever an outcome needs its display label without the pill chrome. */
export const OUTCOME_LABELS: Record<ClaimOutcomeType, () => string> = {
  [ClaimOutcome.Pending]: m.outcome_pending,
  [ClaimOutcome.Accepted]: m.outcome_accepted,
  [ClaimOutcome.Rejected]: m.outcome_rejected,
  [ClaimOutcome.Archived]: m.outcome_archived,
}

/**
 * Outcome pill in the internal design language (dot + tinted pill; pending
 * amber / accepted green / rejected red / archived gray). Internal-only —
 * the shared OutcomeBadge keeps serving admin.
 */
export function OutcomePill({
  outcome,
  className,
}: {
  outcome: ClaimOutcomeType
  className?: string
}) {
  return (
    <InternalPill tone={OUTCOME_TONES[outcome]} dot className={className}>
      {OUTCOME_LABELS[outcome]()}
    </InternalPill>
  )
}
