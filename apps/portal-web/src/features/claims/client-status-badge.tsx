import { m } from '@mr/i18n'
import { ClaimOutcome } from '@mr/shared'
import { CheckCircle2, Clock, TriangleAlert } from 'lucide-react'
import type { ComponentType } from 'react'

// Portal-owned status badge — uses the P0 dark status tokens (mr-status-*),
// NOT @mr/ui OutcomeBadge (whose light subtle colors read wrong on the dark
// portal). Archived is never shown to clients, so only three states here.
type VisibleOutcome =
  | typeof ClaimOutcome.Pending
  | typeof ClaimOutcome.Accepted
  | typeof ClaimOutcome.Rejected

interface StatusConfig {
  readonly label: () => string
  readonly icon: ComponentType<{ className?: string }>
  readonly className: string
}

const STATUS_CONFIG: Record<VisibleOutcome, StatusConfig> = {
  [ClaimOutcome.Pending]: {
    label: m.portal_claims_status_progress,
    icon: Clock,
    className: 'border-mr-status-progress-border bg-mr-status-progress-bg text-mr-status-progress',
  },
  [ClaimOutcome.Accepted]: {
    label: m.portal_claims_status_accepted,
    icon: CheckCircle2,
    className: 'border-mr-status-accepted-border bg-mr-status-accepted-bg text-mr-status-accepted',
  },
  [ClaimOutcome.Rejected]: {
    label: m.portal_claims_status_rejected,
    icon: TriangleAlert,
    className: 'border-mr-status-rejected-border bg-mr-status-rejected-bg text-mr-status-rejected',
  },
}

export interface ClientStatusBadgeProps {
  outcome: VisibleOutcome
}

export function ClientStatusBadge({ outcome }: ClientStatusBadgeProps) {
  const config = STATUS_CONFIG[outcome]
  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 text-[11.5px] font-semibold ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label()}
    </span>
  )
}
