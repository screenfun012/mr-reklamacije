import { ClaimKind, type DomaceClaimDetail } from '@mr/shared'
import { getRouteApi } from '@tanstack/react-router'

import { ClaimReportTab } from '../../claim-reports/claim-report-tab.js'
import { DomaceClaimInspectionReportSection } from './domace-claim-inspection-report-section.js'

export interface DomaceClaimReportTabProps {
  claim: DomaceClaimDetail
  /** `domace_claims.update` — who may write the inspection report. */
  canEditInspection: boolean
}

const rootRoute = getRouteApi('__root__')

/**
 * "Izveštaj" — the same two cards as EMOTIVE (inspection report, then the document that becomes
 * the PDF), minus everything about publishing: a DOMAĆA claim has no portal to publish to.
 */
export function DomaceClaimReportTab({
  claim,
  canEditInspection,
}: DomaceClaimReportTabProps): React.ReactElement {
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []

  const canView = permissions.includes('claim_reports.view')
  const canEdit = permissions.includes('claim_reports.update')
  const canExport = permissions.includes('claim_reports.export')

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4">
      <DomaceClaimInspectionReportSection claim={claim} canEdit={canEditInspection} />

      <ClaimReportTab
        claimKind={ClaimKind.Domace}
        claimId={claim.id}
        canView={canView}
        canEdit={canEdit}
        canExport={canExport}
      />
    </div>
  )
}
