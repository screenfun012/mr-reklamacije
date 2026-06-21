import { emotiveClaimDetailOptions, formatListDateTime, ClaimOutcome } from '@mr/shared'
import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'

import { EmotiveClaimBasicSection } from './emotive-claim-basic-section'
import { EmotiveClaimFaultsSection } from './emotive-claim-faults-section'
import { EmotiveClaimStatusActions } from './emotive-claim-status-actions'

export interface EmotiveClaimDetailViewProps {
  id: string
}

const rootRoute = getRouteApi('__root__')

export function EmotiveClaimDetailView({ id }: EmotiveClaimDetailViewProps): React.ReactElement {
  const { data: claim } = useSuspenseQuery(emotiveClaimDetailOptions(id))
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions
  const canChangeOutcome = permissions?.includes('emotive_claims.change_outcome') === true
  const canReopen = permissions?.includes('emotive_claims.reopen') === true
  const canEditBasic =
    claim.outcome === ClaimOutcome.Pending &&
    permissions?.includes('emotive_claims.update') === true
  const canEditFaults = canEditBasic

  return (
    <div className="flex flex-col gap-6">
      <EmotiveClaimBasicSection claim={claim} canEdit={canEditBasic} />

      <EmotiveClaimStatusActions
        claimId={claim.id}
        currentOutcome={claim.outcome}
        canChangeOutcome={canChangeOutcome}
        canReopen={canReopen}
      />

      <EmotiveClaimFaultsSection claim={claim} canEdit={canEditFaults} />

      <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
        <Heading level="h3" as="h2" className="text-foreground">
          {m.emotive_claims_detail_section_notes()}
        </Heading>
        {claim.internalNotes ? (
          <p className="text-sm whitespace-pre-wrap text-foreground">{claim.internalNotes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{m.emotive_claims_detail_notes_empty()}</p>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        {m.emotive_claims_detail_field_updated_at()}: {formatListDateTime(claim.updatedAt)}
      </p>
    </div>
  )
}
