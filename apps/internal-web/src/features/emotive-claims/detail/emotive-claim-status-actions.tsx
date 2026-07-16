import { m } from '@mr/i18n'
import { ClaimOutcome, OUTCOME_REGISTRY, type ClaimOutcome as ClaimOutcomeType } from '@mr/shared'
import { Check, Lock } from 'lucide-react'
import { useState } from 'react'

import { InternalButton, type InternalButtonVariant } from '~/components/internal-button'

import { useChangeEmotiveClaimOutcome } from './use-change-emotive-claim-outcome'

export interface EmotiveClaimStatusActionsProps {
  claimId: string
  currentOutcome: ClaimOutcomeType
  /** Holder of emotive_claims.change_outcome (operator + admin). */
  canChangeOutcome: boolean
  /** Holder of emotive_claims.reopen — the admin-only unlock key. */
  canReopen: boolean
  layout?: 'section' | 'inline'
}

/** Outcomes a pending claim can move to. */
const COMPLETION_OUTCOMES: readonly ClaimOutcomeType[] = [
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
]

const ACTION_LABEL: Record<ClaimOutcomeType, () => string> = {
  [ClaimOutcome.Accepted]: () => m.emotive_claims_detail_status_action_accept(),
  [ClaimOutcome.Rejected]: () => m.emotive_claims_detail_status_action_reject(),
  [ClaimOutcome.Pending]: () => m.emotive_claims_detail_status_action_reopen(),
  [ClaimOutcome.Archived]: () => m.outcome_archived(),
}

const ACTION_VARIANT: Record<ClaimOutcomeType, InternalButtonVariant> = {
  [ClaimOutcome.Accepted]: 'green',
  [ClaimOutcome.Rejected]: 'outline-red',
  [ClaimOutcome.Pending]: 'outline',
  [ClaimOutcome.Archived]: 'outline',
}

export function EmotiveClaimStatusActions({
  claimId,
  currentOutcome,
  canChangeOutcome,
  canReopen,
  layout = 'section',
}: EmotiveClaimStatusActionsProps): React.ReactElement | null {
  const mutation = useChangeEmotiveClaimOutcome(claimId)
  const [confirmingOutcome, setConfirmingOutcome] = useState<ClaimOutcomeType | null>(null)

  // A completed (accepted/rejected) claim is locked: editing is frozen and the
  // only available action is an admin reopen back to pending.
  const isLocked = currentOutcome !== ClaimOutcome.Pending

  // Render the section for anyone who can act on the claim: change_outcome
  // holders (pending or locked), or reopen holders on a locked claim.
  if (!canChangeOutcome && !(canReopen && isLocked)) {
    return null
  }

  // Registry-driven: reachable statuses come from the outcome registry, not
  // hardcoded values. A pending claim offers accept/reject (change_outcome);
  // a locked claim offers only reopen (admin-only).
  const targets = isLocked
    ? canReopen
      ? OUTCOME_REGISTRY.filter((definition) => definition.key === ClaimOutcome.Pending)
      : []
    : canChangeOutcome
      ? OUTCOME_REGISTRY.filter((definition) => COMPLETION_OUTCOMES.includes(definition.key))
      : []

  const isPending = mutation.isPending
  const isAcceptConfirm = confirmingOutcome === ClaimOutcome.Accepted

  // Accept and reject both irreversibly lock the claim, so both confirm first;
  // reopen (admin unlock) is safe and fires immediately.
  const handleTarget = (outcome: ClaimOutcomeType): void => {
    if (outcome === ClaimOutcome.Accepted || outcome === ClaimOutcome.Rejected) {
      setConfirmingOutcome(outcome)
      return
    }
    mutation.mutate(outcome)
  }

  const confirmOutcome = (): void => {
    if (!confirmingOutcome) return
    const outcome = confirmingOutcome
    setConfirmingOutcome(null)
    mutation.mutate(outcome)
  }

  return (
    <div
      className={
        layout === 'section'
          ? 'flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6'
          : 'flex flex-wrap items-center gap-3'
      }
    >
      {layout === 'section' ? (
        <h2 className="text-[15px] font-extrabold text-mri-text">
          {m.emotive_claims_detail_status_section()}
        </h2>
      ) : null}

      {isLocked ? (
        <div
          className="flex items-center gap-2 text-sm text-mri-text2"
          role="status"
          data-testid="emotive-claim-lock-indicator"
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          <span>{m.emotive_claims_detail_status_locked()}</span>
        </div>
      ) : null}

      {confirmingOutcome ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-mri-text">
            {isAcceptConfirm
              ? m.emotive_claims_detail_status_accept_confirm()
              : m.emotive_claims_detail_status_reject_confirm()}
          </span>
          <InternalButton
            type="button"
            variant={isAcceptConfirm ? 'green' : 'red'}
            className="h-9 w-auto px-4 text-[11.5px]"
            disabled={isPending}
            onClick={confirmOutcome}
          >
            {isAcceptConfirm
              ? m.emotive_claims_detail_status_accept_confirm_yes()
              : m.emotive_claims_detail_status_reject_confirm_yes()}
          </InternalButton>
          <InternalButton
            type="button"
            variant="outline"
            className="h-9 w-auto px-4 text-[11.5px]"
            disabled={isPending}
            onClick={() => setConfirmingOutcome(null)}
          >
            {m.emotive_claims_detail_status_cancel()}
          </InternalButton>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {targets.map((definition) => (
            <InternalButton
              key={definition.key}
              type="button"
              variant={ACTION_VARIANT[definition.key]}
              className="h-10 w-auto px-5 text-xs"
              disabled={isPending}
              onClick={() => handleTarget(definition.key)}
            >
              {definition.key === ClaimOutcome.Accepted ? (
                <Check className="size-3.5" aria-hidden />
              ) : null}
              {ACTION_LABEL[definition.key]()}
            </InternalButton>
          ))}
        </div>
      )}

      {mutation.isError ? (
        <p className="text-sm text-mri-bad" role="alert">
          {m.emotive_claims_detail_status_error()}
        </p>
      ) : null}
    </div>
  )
}
