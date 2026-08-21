import { m } from '@mr/i18n'
import { ClaimOutcome } from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { Check } from 'lucide-react'
import { useState } from 'react'

import { InternalButton, type InternalButtonVariant } from '~/components/internal-button'

import { useChangeDomaceClaimOutcome } from './use-change-domace-claim-outcome.js'

export interface DomaceClaimStatusActionsProps {
  claimId: string
  canChangeOutcome: boolean
}

/** The only two outcomes an operator can move a claim to from this panel. */
const COMPLETION_OUTCOMES = [ClaimOutcome.Accepted, ClaimOutcome.Rejected] as const
type CompletionOutcome = (typeof COMPLETION_OUTCOMES)[number]

const ACTION_LABEL: Record<CompletionOutcome, () => string> = {
  [ClaimOutcome.Accepted]: () => m.emotive_claims_detail_status_action_accept(),
  [ClaimOutcome.Rejected]: () => m.emotive_claims_detail_status_action_reject(),
}

const ACTION_VARIANT: Record<CompletionOutcome, InternalButtonVariant> = {
  [ClaimOutcome.Accepted]: 'green',
  [ClaimOutcome.Rejected]: 'outline-red',
}

const CONFIRM_TITLE: Record<CompletionOutcome, () => string> = {
  [ClaimOutcome.Accepted]: () => m.internal_claim_outcome_confirm_accepted(),
  [ClaimOutcome.Rejected]: () => m.internal_claim_outcome_confirm_rejected(),
}

/** PRIHVATI / ODBIJ, in the claim's title row (handoff §1.2). */
export function DomaceClaimStatusActions({
  claimId,
  canChangeOutcome,
}: DomaceClaimStatusActionsProps): React.ReactElement | null {
  const mutation = useChangeDomaceClaimOutcome(claimId)
  const [pendingOutcome, setPendingOutcome] = useState<CompletionOutcome | null>(null)

  if (!canChangeOutcome) {
    return null
  }

  const isPending = mutation.isPending

  // Outcome changes now happen freely at any time (no more edit-lock/reopen),
  // so a confirm dialog is the only guard against an accidental click.
  const confirmOutcome = (): void => {
    if (pendingOutcome === null) return
    const outcome = pendingOutcome
    setPendingOutcome(null)
    mutation.mutate(outcome)
  }

  return (
    <>
      {COMPLETION_OUTCOMES.map((outcome) => (
        <InternalButton
          key={outcome}
          type="button"
          variant={ACTION_VARIANT[outcome]}
          className="h-[38px] w-auto px-4 text-[11.5px] tracking-[0.06em]"
          disabled={isPending}
          onClick={() => setPendingOutcome(outcome)}
        >
          {outcome === ClaimOutcome.Accepted ? <Check className="size-3.5" aria-hidden /> : null}
          {ACTION_LABEL[outcome]()}
        </InternalButton>
      ))}

      {mutation.isError ? (
        <p className="basis-full text-right text-[12.5px] text-mri-bad" role="alert">
          {m.emotive_claims_detail_status_error()}
        </p>
      ) : null}

      <ConfirmDialog
        open={pendingOutcome !== null}
        onOpenChange={(open) => {
          if (!open) setPendingOutcome(null)
        }}
        title={pendingOutcome !== null ? CONFIRM_TITLE[pendingOutcome]() : null}
        confirmLabel={pendingOutcome !== null ? ACTION_LABEL[pendingOutcome]() : null}
        variant={pendingOutcome === ClaimOutcome.Rejected ? 'destructive' : 'default'}
        pending={isPending}
        onConfirm={confirmOutcome}
      />
    </>
  )
}
