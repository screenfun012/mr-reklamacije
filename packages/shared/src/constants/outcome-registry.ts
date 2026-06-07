import { ClaimOutcome, type ClaimOutcome as ClaimOutcomeType } from '../enums.js'
import { OUTCOME_BADGE_CLASSES } from './outcome-colors.js'

export type OutcomeLabelKey =
  | 'outcome_pending'
  | 'outcome_accepted'
  | 'outcome_rejected'
  | 'outcome_archived'

export interface OutcomeDefinition {
  key: ClaimOutcomeType
  color: 'amber' | 'emerald' | 'rose' | 'slate'
  labelKey: OutcomeLabelKey
  badgeClass: string
}

const OUTCOME_COLOR_BY_KEY: Record<ClaimOutcomeType, OutcomeDefinition['color']> = {
  [ClaimOutcome.Pending]: 'amber',
  [ClaimOutcome.Accepted]: 'emerald',
  [ClaimOutcome.Rejected]: 'rose',
  [ClaimOutcome.Archived]: 'slate',
}

const OUTCOME_LABEL_BY_KEY: Record<ClaimOutcomeType, OutcomeLabelKey> = {
  [ClaimOutcome.Pending]: 'outcome_pending',
  [ClaimOutcome.Accepted]: 'outcome_accepted',
  [ClaimOutcome.Rejected]: 'outcome_rejected',
  [ClaimOutcome.Archived]: 'outcome_archived',
}

export const OUTCOME_REGISTRY: readonly OutcomeDefinition[] = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
  ClaimOutcome.Archived,
].map((key) => ({
  key,
  color: OUTCOME_COLOR_BY_KEY[key],
  labelKey: OUTCOME_LABEL_BY_KEY[key],
  badgeClass: OUTCOME_BADGE_CLASSES[key],
}))

export const OUTCOME_BY_KEY: Record<ClaimOutcomeType, OutcomeDefinition> = Object.fromEntries(
  OUTCOME_REGISTRY.map((definition) => [definition.key, definition]),
) as Record<ClaimOutcomeType, OutcomeDefinition>
