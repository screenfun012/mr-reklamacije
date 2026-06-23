import { ClaimKind, ClaimOutcome } from '@mr/shared'
import { getRouteApi } from '@tanstack/react-router'

import { ClaimReportTab } from '../../claim-reports/claim-report-tab.js'

export interface DomaceClaimReportTabProps {
  claimId: string
  outcome: ClaimOutcome
}

const rootRoute = getRouteApi('__root__')

export function DomaceClaimReportTab({
  claimId,
  outcome,
}: DomaceClaimReportTabProps): React.ReactElement {
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []

  const canView = permissions.includes('claim_reports.view')
  const canEdit = outcome === ClaimOutcome.Pending && permissions.includes('claim_reports.update')

  return (
    <ClaimReportTab
      claimKind={ClaimKind.Domace}
      claimId={claimId}
      canView={canView}
      canEdit={canEdit}
      claimLocked={outcome !== ClaimOutcome.Pending}
    />
  )
}
