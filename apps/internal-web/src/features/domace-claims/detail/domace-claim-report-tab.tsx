import { ClaimKind } from '@mr/shared'
import { getRouteApi } from '@tanstack/react-router'

import { ClaimReportTab } from '../../claim-reports/claim-report-tab.js'

export interface DomaceClaimReportTabProps {
  claimId: string
}

const rootRoute = getRouteApi('__root__')

export function DomaceClaimReportTab({ claimId }: DomaceClaimReportTabProps): React.ReactElement {
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []

  const canView = permissions.includes('claim_reports.view')
  const canEdit = permissions.includes('claim_reports.update')
  const canExport = permissions.includes('claim_reports.export')

  return (
    <ClaimReportTab
      claimKind={ClaimKind.Domace}
      claimId={claimId}
      canView={canView}
      canEdit={canEdit}
      canExport={canExport}
    />
  )
}
