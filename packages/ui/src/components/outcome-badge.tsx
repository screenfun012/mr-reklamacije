import { m } from '@mr/i18n'
import { OUTCOME_BY_KEY, type ClaimOutcome, type OutcomeLabelKey } from '@mr/shared'
import { cn } from '../lib/cn.js'

const OUTCOME_LABELS: Record<OutcomeLabelKey, () => string> = {
  outcome_pending: () => m.outcome_pending(),
  outcome_accepted: () => m.outcome_accepted(),
  outcome_rejected: () => m.outcome_rejected(),
  outcome_archived: () => m.outcome_archived(),
}

const OUTCOME_DOT_CLASSES: Record<ClaimOutcome, string> = {
  pending: 'bg-amber-500',
  accepted: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  archived: 'bg-slate-400',
}

export interface OutcomeBadgeProps {
  outcome: ClaimOutcome
  className?: string
}

export function OutcomeBadge({ outcome, className }: OutcomeBadgeProps) {
  const definition = OUTCOME_BY_KEY[outcome]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        definition.badgeClass,
        className,
      )}
    >
      <span
        className={cn('size-1.5 shrink-0 rounded-full', OUTCOME_DOT_CLASSES[outcome])}
        aria-hidden
      />
      {OUTCOME_LABELS[definition.labelKey]()}
    </span>
  )
}
