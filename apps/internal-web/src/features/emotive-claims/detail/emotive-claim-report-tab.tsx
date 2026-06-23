import { ClaimKind, ClaimOutcome } from '@mr/shared'
import { getRouteApi } from '@tanstack/react-router'

import { ClaimReportTab } from '../../claim-reports/claim-report-tab.js'

export interface EmotiveClaimReportTabProps {
  claimId: string
  outcome: ClaimOutcome
}

const rootRoute = getRouteApi('__root__')

export function EmotiveClaimReportTab({
  claimId,
  outcome,
}: EmotiveClaimReportTabProps): React.ReactElement {
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []

  const canView = permissions.includes('claim_reports.view')
  const canEdit = outcome === ClaimOutcome.Pending && permissions.includes('claim_reports.update')
  const canExport = permissions.includes('claim_reports.export')

  return (
    <ClaimReportTab
      claimKind={ClaimKind.Emotive}
      claimId={claimId}
      canView={canView}
      canEdit={canEdit}
      canExport={canExport}
      claimLocked={outcome !== ClaimOutcome.Pending}
    />
  )
}
