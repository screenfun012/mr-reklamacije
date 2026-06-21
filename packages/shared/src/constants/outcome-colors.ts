import { ClaimOutcome, type ClaimOutcome as ClaimOutcomeType } from '../enums.js'

/** Tailwind classes for claim outcome badges (MR brandbook semantic colors). */
export const OUTCOME_BADGE_CLASSES: Record<ClaimOutcomeType, string> = {
  [ClaimOutcome.Pending]:
    'border-mr-warning/45 bg-mr-warning-subtle text-mr-warning-strong shadow-sm shadow-mr-warning/15 dark:border-mr-warning/55 dark:bg-mr-warning/20 dark:text-mr-warning dark:shadow-mr-warning/10',
  [ClaimOutcome.Accepted]:
    'border-mr-success/45 bg-mr-success-subtle text-mr-success-strong shadow-sm shadow-mr-success/15 dark:border-mr-success/55 dark:bg-mr-success/20 dark:text-mr-success dark:shadow-mr-success/10',
  [ClaimOutcome.Rejected]:
    'border-mr-error/45 bg-mr-error-subtle text-mr-error-strong shadow-sm shadow-mr-error/15 dark:border-mr-error/55 dark:bg-mr-error/20 dark:text-mr-error dark:shadow-mr-error/10',
  [ClaimOutcome.Archived]:
    'border-mr-neutral-border bg-mr-neutral-subtle text-mr-neutral-muted shadow-sm dark:border-mr-neutral-muted/45 dark:bg-mr-neutral-muted/20 dark:text-mr-neutral-border',
}

/** Saturated icon tint per outcome — icons read clearly against subtle badge fills. */
export const OUTCOME_ICON_CLASSES: Record<ClaimOutcomeType, string> = {
  [ClaimOutcome.Pending]: 'text-mr-warning',
  [ClaimOutcome.Accepted]: 'text-mr-success',
  [ClaimOutcome.Rejected]: 'text-mr-error',
  [ClaimOutcome.Archived]: 'text-mr-neutral-muted dark:text-mr-neutral-border',
}
