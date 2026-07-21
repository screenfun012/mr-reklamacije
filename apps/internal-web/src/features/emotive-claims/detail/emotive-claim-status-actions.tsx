import { m } from '@mr/i18n'
import { ClaimOutcome, type ClaimOutcome as ClaimOutcomeType } from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { Check } from 'lucide-react'
import { useState } from 'react'

import { InternalButton, type InternalButtonVariant } from '~/components/internal-button'
import { OUTCOME_LABELS } from '~/components/outcome-pill'

import { EmotiveClaimStageBadge } from '../emotive-claim-stage-badge'
import { useChangeEmotiveClaimOutcome } from './use-change-emotive-claim-outcome'
import { usePublishEmotiveClaim } from './use-publish-emotive-claim'

export interface EmotiveClaimStatusActionsProps {
  claimId: string
  outcome: ClaimOutcomeType
  clientVisibleAt: string | null
  publishedAt: string | null
  /** Holder of emotive_claims.change_outcome (operator + admin). */
  canChangeOutcome: boolean
  /** Holder of emotive_claims.publish (operator + admin). */
  canPublish: boolean
  layout?: 'section' | 'inline'
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

export function EmotiveClaimStatusActions({
  claimId,
  outcome,
  clientVisibleAt,
  publishedAt,
  canChangeOutcome,
  canPublish,
  layout = 'section',
}: EmotiveClaimStatusActionsProps): React.ReactElement {
  const outcomeMutation = useChangeEmotiveClaimOutcome(claimId)
  const publishMutation = usePublishEmotiveClaim(claimId)
  const [pendingOutcome, setPendingOutcome] = useState<CompletionOutcome | null>(null)
  const [confirmingPublish, setConfirmingPublish] = useState(false)

  const isPending = outcomeMutation.isPending
  const showPublishAction = canPublish && publishedAt === null

  // Outcome changes now happen freely at any time (no more edit-lock/reopen),
  // so a confirm dialog is the only guard against an accidental click.
  const confirmOutcome = (): void => {
    if (pendingOutcome === null) return
    const value = pendingOutcome
    setPendingOutcome(null)
    outcomeMutation.mutate(value)
  }

  // Publishing is a one-way, decided action — always confirm, and never
  // update the cache optimistically (invalidate-only, see the mutation hook).
  const confirmPublish = (): void => {
    setConfirmingPublish(false)
    publishMutation.mutate()
  }

  const publishDescription =
    outcome === ClaimOutcome.Pending
      ? m.emotive_claims_detail_publish_confirm_description_pending({
          outcome: OUTCOME_LABELS[outcome](),
        })
      : m.emotive_claims_detail_publish_confirm_description_decided({
          outcome: OUTCOME_LABELS[outcome](),
        })

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

      <div className="flex flex-wrap items-center gap-2">
        <EmotiveClaimStageBadge clientVisibleAt={clientVisibleAt} publishedAt={publishedAt} />
        {publishedAt === null ? (
          <span className="text-[11px] text-mri-text2">
            {m.emotive_claims_stage_not_published_cue()}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {canChangeOutcome
          ? COMPLETION_OUTCOMES.map((completionOutcome) => (
              <InternalButton
                key={completionOutcome}
                type="button"
                variant={ACTION_VARIANT[completionOutcome]}
                className="h-10 w-auto px-5 text-xs"
                disabled={isPending}
                onClick={() => setPendingOutcome(completionOutcome)}
              >
                {completionOutcome === ClaimOutcome.Accepted ? (
                  <Check className="size-3.5" aria-hidden />
                ) : null}
                {ACTION_LABEL[completionOutcome]()}
              </InternalButton>
            ))
          : null}

        {showPublishAction ? (
          <InternalButton
            type="button"
            variant="outline"
            className="h-10 w-auto px-5 text-xs"
            disabled={publishMutation.isPending}
            onClick={() => setConfirmingPublish(true)}
          >
            {m.emotive_claims_detail_status_action_publish()}
          </InternalButton>
        ) : null}
      </div>

      {outcomeMutation.isError ? (
        <p className="text-sm text-mri-bad" role="alert">
          {m.emotive_claims_detail_status_error()}
        </p>
      ) : null}

      {publishMutation.isError ? (
        <p className="text-sm text-mri-bad" role="alert">
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

      <ConfirmDialog
        open={confirmingPublish}
        onOpenChange={(open) => {
          if (!open) setConfirmingPublish(false)
        }}
        title={m.emotive_claims_detail_publish_confirm_title()}
        description={publishDescription}
        confirmLabel={m.emotive_claims_detail_status_action_publish()}
        variant="default"
        pending={publishMutation.isPending}
        onConfirm={confirmPublish}
      />
    </div>
  )
}
