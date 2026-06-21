import { m } from '@mr/i18n'
import { ClaimOutcome, OUTCOME_REGISTRY, type ClaimOutcome as ClaimOutcomeType } from '@mr/shared'
import { Button, Heading } from '@mr/ui'
import { Lock } from 'lucide-react'
import { useState } from 'react'

import { useChangeDomaceClaimOutcome } from './use-change-domace-claim-outcome.js'

export interface DomaceClaimStatusActionsProps {
  claimId: string
  currentOutcome: ClaimOutcomeType
  canChangeOutcome: boolean
  canReopen: boolean
}

const COMPLETION_OUTCOMES: readonly ClaimOutcomeType[] = [
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
]

type ActionVariant = 'default' | 'destructive' | 'outline'

const ACTION_LABEL: Record<ClaimOutcomeType, () => string> = {
  [ClaimOutcome.Accepted]: () => m.emotive_claims_detail_status_action_accept(),
  [ClaimOutcome.Rejected]: () => m.emotive_claims_detail_status_action_reject(),
  [ClaimOutcome.Pending]: () => m.emotive_claims_detail_status_action_reopen(),
  [ClaimOutcome.Archived]: () => m.outcome_archived(),
}

const ACTION_VARIANT: Record<ClaimOutcomeType, ActionVariant> = {
  [ClaimOutcome.Accepted]: 'default',
  [ClaimOutcome.Rejected]: 'destructive',
  [ClaimOutcome.Pending]: 'outline',
  [ClaimOutcome.Archived]: 'outline',
}

export function DomaceClaimStatusActions({
  claimId,
  currentOutcome,
  canChangeOutcome,
  canReopen,
}: DomaceClaimStatusActionsProps): React.ReactElement | null {
  const mutation = useChangeDomaceClaimOutcome(claimId)
  const [confirmingReject, setConfirmingReject] = useState(false)

  const isLocked = currentOutcome !== ClaimOutcome.Pending

  if (!canChangeOutcome && !(canReopen && isLocked)) {
    return null
  }

  const targets = isLocked
    ? canReopen
      ? OUTCOME_REGISTRY.filter((definition) => definition.key === ClaimOutcome.Pending)
      : []
    : canChangeOutcome
      ? OUTCOME_REGISTRY.filter((definition) => COMPLETION_OUTCOMES.includes(definition.key))
      : []

  const isPending = mutation.isPending

  const handleTarget = (outcome: ClaimOutcomeType): void => {
    if (outcome === ClaimOutcome.Rejected) {
      setConfirmingReject(true)
      return
    }
    mutation.mutate(outcome)
  }

  const confirmReject = (): void => {
    setConfirmingReject(false)
    mutation.mutate(ClaimOutcome.Rejected)
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
      <Heading level="h3" as="h2" className="text-foreground">
        {m.emotive_claims_detail_status_section()}
      </Heading>

      {isLocked ? (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
          data-testid="domace-claim-lock-indicator"
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          <span>{m.emotive_claims_detail_status_locked()}</span>
        </div>
      ) : null}

      {confirmingReject ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-foreground">
            {m.emotive_claims_detail_status_reject_confirm()}
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={confirmReject}
          >
            {m.emotive_claims_detail_status_reject_confirm_yes()}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setConfirmingReject(false)}
          >
            {m.emotive_claims_detail_status_cancel()}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {targets.map((definition) => (
            <Button
              key={definition.key}
              type="button"
              variant={ACTION_VARIANT[definition.key]}
              size="sm"
              disabled={isPending}
              onClick={() => handleTarget(definition.key)}
            >
              {ACTION_LABEL[definition.key]()}
            </Button>
          ))}
        </div>
      )}

      {mutation.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {m.emotive_claims_detail_status_error()}
        </p>
      ) : null}
    </section>
  )
}
