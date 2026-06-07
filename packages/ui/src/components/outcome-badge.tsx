import { m } from '@mr/i18n'
import { OUTCOME_BADGE_CLASSES, type ClaimOutcome } from '@mr/shared'
import { cn } from '../lib/cn.js'

const OUTCOME_LABELS: Record<ClaimOutcome, () => string> = {
  pending: () => m.outcome_pending(),
  accepted: () => m.outcome_accepted(),
  rejected: () => m.outcome_rejected(),
  archived: () => m.outcome_archived(),
}

export interface OutcomeBadgeProps {
  outcome: ClaimOutcome
  className?: string
}

export function OutcomeBadge({ outcome, className }: OutcomeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        OUTCOME_BADGE_CLASSES[outcome],
        className,
      )}
    >
      {OUTCOME_LABELS[outcome]()}
    </span>
  )
}
