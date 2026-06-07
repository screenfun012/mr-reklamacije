import { ClaimOutcome, type ClaimOutcome as ClaimOutcomeType } from '../enums.js'

/** Tailwind classes for claim outcome badges (docs/09-ui-ux.md). */
export const OUTCOME_BADGE_CLASSES: Record<ClaimOutcomeType, string> = {
  [ClaimOutcome.Pending]: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  [ClaimOutcome.Accepted]:
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  [ClaimOutcome.Rejected]: 'bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100',
  [ClaimOutcome.Archived]: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}
