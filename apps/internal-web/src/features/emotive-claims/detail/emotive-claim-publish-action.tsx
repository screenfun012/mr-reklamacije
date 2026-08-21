import { m } from '@mr/i18n'
import { ClaimOutcome, type ClaimOutcome as ClaimOutcomeType } from '@mr/shared'
import { cn, ConfirmDialog } from '@mr/ui'
import { useState } from 'react'

import { OUTCOME_LABELS } from '~/components/outcome-pill'

import { usePublishEmotiveClaim } from './use-publish-emotive-claim'

export interface EmotiveClaimPublishActionProps {
  claimId: string
  outcome: ClaimOutcomeType
  publishedAt: string | null
  /** Holder of `emotive_claims.publish` (operator + admin). */
  canPublish: boolean
  className?: string
  label?: string
}

/**
 * "Objavi klijentu" — Gate B, wherever it is offered: the "Klijent vidi" card and the report
 * tab both show it, and both mean the same one-way, confirmed action. One component so the
 * confirm copy and the mutation cannot drift between the two places (handoff §5).
 */
export function EmotiveClaimPublishAction({
  claimId,
  outcome,
  publishedAt,
  canPublish,
  className,
  label,
}: EmotiveClaimPublishActionProps): React.ReactElement | null {
  const publish = usePublishEmotiveClaim(claimId)
  const [confirming, setConfirming] = useState(false)

  if (!canPublish || publishedAt !== null) {
    return null
  }

  const description =
    outcome === ClaimOutcome.Pending
      ? m.emotive_claims_detail_publish_confirm_description_pending({
          outcome: OUTCOME_LABELS[outcome](),
        })
      : m.emotive_claims_detail_publish_confirm_description_decided({
          outcome: OUTCOME_LABELS[outcome](),
        })

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={publish.isPending}
        className={cn(
          'inline-flex h-[34px] cursor-pointer items-center rounded-[9px] border border-mri-border2 bg-mri-raised px-[13px] text-[11px] font-bold uppercase tracking-[0.06em] text-mri-text transition-colors hover:border-mri-text2 disabled:opacity-60',
          className,
        )}
      >
        {label ?? m.emotive_claims_publish_action()}
      </button>

      {publish.isError ? (
        <p className="basis-full text-[12.5px] text-mri-bad" role="alert">
          {m.emotive_claims_detail_status_error()}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) setConfirming(false)
        }}
        title={m.emotive_claims_detail_publish_confirm_title()}
        description={description}
        confirmLabel={m.emotive_claims_detail_status_action_publish()}
        variant="default"
        pending={publish.isPending}
        onConfirm={() => {
          setConfirming(false)
          publish.mutate()
        }}
      />
    </>
  )
}
