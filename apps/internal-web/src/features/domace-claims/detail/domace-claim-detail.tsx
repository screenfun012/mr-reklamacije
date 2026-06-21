import { ClaimOutcome, domaceClaimDetailOptions, formatListDateTime } from '@mr/shared'
import { m } from '@mr/i18n'
import { Heading } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'

import { DomaceClaimAmountSection } from './domace-claim-amount-section.js'
import { DomaceClaimBasicSection } from './domace-claim-basic-section.js'
import { DomaceClaimFaultsSection } from './domace-claim-faults-section.js'
import { DomaceClaimStatusActions } from './domace-claim-status-actions.js'

export interface DomaceClaimDetailViewProps {
  id: string
}

const rootRoute = getRouteApi('__root__')

export function DomaceClaimDetailView({ id }: DomaceClaimDetailViewProps): React.ReactElement {
  const { data: claim } = useSuspenseQuery(domaceClaimDetailOptions(id))
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions
  const canChangeOutcome = permissions?.includes('domace_claims.change_outcome') === true
  const canReopen = permissions?.includes('domace_claims.reopen') === true
  const canEditBasic =
    claim.outcome === ClaimOutcome.Pending && permissions?.includes('domace_claims.update') === true
  const canEditFaults = canEditBasic
  const canEditAmount =
    claim.outcome === ClaimOutcome.Accepted &&
    permissions?.includes('domace_claims.update') === true

  return (
    <div className="flex flex-col gap-6">
      <DomaceClaimBasicSection claim={claim} canEdit={canEditBasic} />

      <DomaceClaimStatusActions
        claimId={claim.id}
        currentOutcome={claim.outcome}
        canChangeOutcome={canChangeOutcome}
        canReopen={canReopen}
      />

      <DomaceClaimAmountSection claim={claim} canEdit={canEditAmount} />

      <DomaceClaimFaultsSection claim={claim} canEdit={canEditFaults} />

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
