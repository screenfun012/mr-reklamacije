import { m } from '@mr/i18n'
import { ClaimOutcome } from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { Check } from 'lucide-react'
import { useState } from 'react'

import { InternalButton, type InternalButtonVariant } from '~/components/internal-button'

import { useChangeEmotiveClaimOutcome } from './use-change-emotive-claim-outcome'

export interface EmotiveClaimStatusActionsProps {
  claimId: string
  /** Holder of emotive_claims.change_outcome (operator + admin). */
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

/**
 * PRIHVATI / ODBIJ, in the claim's title row (handoff §1.2). Publishing to the client is NOT
 * here: it belongs beside what the client actually sees — the "Klijent vidi" card and the
 * report tab — and the badge that says whether it happened is a badge, not a button.
 */
export function EmotiveClaimStatusActions({
  claimId,
  canChangeOutcome,
}: EmotiveClaimStatusActionsProps): React.ReactElement | null {
  const outcomeMutation = useChangeEmotiveClaimOutcome(claimId)
  const [pendingOutcome, setPendingOutcome] = useState<CompletionOutcome | null>(null)

  const isPending = outcomeMutation.isPending

  // Outcome changes now happen freely at any time (no more edit-lock/reopen),
  // so a confirm dialog is the only guard against an accidental click.
  const confirmOutcome = (): void => {
    if (pendingOutcome === null) return
    const value = pendingOutcome
    setPendingOutcome(null)
    outcomeMutation.mutate(value)
  }

  if (!canChangeOutcome) {
    return null
  }

  return (
    <>
      {COMPLETION_OUTCOMES.map((completionOutcome) => (
        <InternalButton
          key={completionOutcome}
          type="button"
          variant={ACTION_VARIANT[completionOutcome]}
          className="h-[38px] w-auto px-4 text-[11.5px] tracking-[0.06em]"
          disabled={isPending}
          onClick={() => setPendingOutcome(completionOutcome)}
        >
          {completionOutcome === ClaimOutcome.Accepted ? (
            <Check className="size-3.5" aria-hidden />
          ) : null}
          {ACTION_LABEL[completionOutcome]()}
        </InternalButton>
      ))}

      {outcomeMutation.isError ? (
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
