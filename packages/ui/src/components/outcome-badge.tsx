import { m } from '@mr/i18n'
import {
  ClaimOutcome,
  OUTCOME_BADGE_CLASSES,
  OUTCOME_ICON_CLASSES,
  type ClaimOutcome as ClaimOutcomeType,
  type OutcomeLabelKey,
} from '@mr/shared'

import { OUTCOME_ICONS } from '../lib/badge-icons.js'
import {
  BADGE_ENTER_ANIMATION_CLASSES,
  BADGE_ICON_CLASSES,
  BADGE_PENDING_ICON_PULSE_CLASSES,
  BADGE_SHELL_CLASSES,
} from '../lib/badge-styles.js'
import { useBadgeEnterAnimation } from '../lib/use-badge-enter-animation.js'
import { cn } from '../lib/cn.js'

const OUTCOME_LABELS: Record<OutcomeLabelKey, () => string> = {
  outcome_pending: () => m.outcome_pending(),
  outcome_accepted: () => m.outcome_accepted(),
  outcome_rejected: () => m.outcome_rejected(),
  outcome_archived: () => m.outcome_archived(),
}

const OUTCOME_LABEL_KEY: Record<ClaimOutcomeType, OutcomeLabelKey> = {
  [ClaimOutcome.Pending]: 'outcome_pending',
  [ClaimOutcome.Accepted]: 'outcome_accepted',
  [ClaimOutcome.Rejected]: 'outcome_rejected',
  [ClaimOutcome.Archived]: 'outcome_archived',
}

export interface OutcomeBadgeProps {
  outcome: ClaimOutcomeType
  className?: string
}

export function OutcomeBadge({ outcome, className }: OutcomeBadgeProps): React.ReactElement {
  const Icon = OUTCOME_ICONS[outcome]
  const isEntering = useBadgeEnterAnimation(outcome)

  return (
    <span
      className={cn(
        BADGE_SHELL_CLASSES,
        OUTCOME_BADGE_CLASSES[outcome],
        isEntering && BADGE_ENTER_ANIMATION_CLASSES,
        className,
      )}
    >
      <Icon
        className={cn(
          BADGE_ICON_CLASSES,
          OUTCOME_ICON_CLASSES[outcome],
          outcome === ClaimOutcome.Pending && BADGE_PENDING_ICON_PULSE_CLASSES,
        )}
        aria-hidden
      />
      {OUTCOME_LABELS[OUTCOME_LABEL_KEY[outcome]]()}
    </span>
  )
}
