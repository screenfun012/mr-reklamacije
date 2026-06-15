import { m } from '@mr/i18n'
import { ClaimOutcome, OUTCOME_REGISTRY, type ClaimOutcome as ClaimOutcomeType } from '@mr/shared'
import { Button } from '@mr/ui'
import { useState } from 'react'

import { useChangeEmotiveClaimOutcome } from './use-change-emotive-claim-outcome'

export interface EmotiveClaimStatusActionsProps {
  claimId: string
  currentOutcome: ClaimOutcomeType
  canChangeOutcome: boolean
}

/** Outcomes reachable through the operator status flow. `archived` is out of scope. */
const FLOW_OUTCOMES: readonly ClaimOutcomeType[] = [
  ClaimOutcome.Pending,
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

export function EmotiveClaimStatusActions({
  claimId,
  currentOutcome,
  canChangeOutcome,
}: EmotiveClaimStatusActionsProps): React.ReactElement | null {
  const mutation = useChangeEmotiveClaimOutcome(claimId)
  const [confirmingReject, setConfirmingReject] = useState(false)

  if (!canChangeOutcome) {
    return null
  }

  // Registry-driven: the set of reachable statuses comes from the outcome
  // registry, not hardcoded values, so custom statuses can slot in later.
  const targets = OUTCOME_REGISTRY.filter(
    (definition) => FLOW_OUTCOMES.includes(definition.key) && definition.key !== currentOutcome,
  )

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
      <h2 className="text-sm font-semibold text-foreground">
        {m.emotive_claims_detail_status_section()}
      </h2>

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
