import { m } from '@mr/i18n'
import type { DomaceClaimDetail } from '@mr/shared'

import { ClaimTextSection } from '../../claims/claim-text-section.js'
import { useUpdateDomaceClaimInspectionReport } from './use-update-domace-claim-inspection-report.js'

interface DomaceClaimInspectionReportSectionProps {
  claim: DomaceClaimDetail
  canEdit: boolean
}

export function DomaceClaimInspectionReportSection({
  claim,
  canEdit,
}: DomaceClaimInspectionReportSectionProps): React.ReactElement {
  const mutation = useUpdateDomaceClaimInspectionReport(claim.id)

  return (
    <ClaimTextSection
      value={claim.inspectionReport}
      heading={m.claims_detail_section_inspection_report()}
      hint={m.claims_detail_inspection_report_hint()}
      emptyText={m.claims_detail_inspection_report_empty()}
      textareaId="claimInspectionReport"
      canEdit={canEdit}
      isSaving={mutation.isPending}
      onSave={(inspectionReport) => mutation.mutateAsync({ inspectionReport })}
    />
  )
}
