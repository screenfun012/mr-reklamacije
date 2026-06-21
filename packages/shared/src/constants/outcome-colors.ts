import { ClaimOutcome, type ClaimOutcome as ClaimOutcomeType } from '../enums.js'

/** Tailwind classes for claim outcome badges (docs/09-ui-ux.md). */
export const OUTCOME_BADGE_CLASSES: Record<ClaimOutcomeType, string> = {
  [ClaimOutcome.Pending]:
    'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900 dark:text-amber-100',
  [ClaimOutcome.Accepted]:
    'border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
  [ClaimOutcome.Rejected]:
    'border-rose-200 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-900 dark:text-rose-100',
  [ClaimOutcome.Archived]:
    'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
}
