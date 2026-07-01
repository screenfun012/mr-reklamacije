import { m } from '@mr/i18n'
import type { EmotiveClaimDetail } from '@mr/shared'

import { ClaimTextSection } from '../../claims/claim-text-section.js'
import { useUpdateEmotiveClaimInspectionReport } from './use-update-emotive-claim-inspection-report.js'

interface EmotiveClaimInspectionReportSectionProps {
  claim: EmotiveClaimDetail
  canEdit: boolean
}

export function EmotiveClaimInspectionReportSection({
  claim,
  canEdit,
}: EmotiveClaimInspectionReportSectionProps): React.ReactElement {
  const mutation = useUpdateEmotiveClaimInspectionReport(claim.id)

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
