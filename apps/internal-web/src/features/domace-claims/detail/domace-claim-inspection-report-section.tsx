import { m } from '@mr/i18n'
import type { DomaceClaimDetail } from '@mr/shared'

import { ClaimTextSection } from '../../claims/claim-text-section.js'
import { useUpdateDomaceClaimInspectionReport } from './use-update-domace-claim-inspection-report.js'

interface DomaceClaimInspectionReportSectionProps {
  claim: DomaceClaimDetail
  canEdit: boolean
}

/**
 * The inspection report of a DOMAĆA claim. Its own hint, not EMOTIVE's: there is no portal on
 * this side, so telling the office the text is "visible to the client on the portal" would be
 * a plain untruth — and the Izveštaj tab now puts that sentence right under the reader's eye.
 */
export function DomaceClaimInspectionReportSection({
  claim,
  canEdit,
}: DomaceClaimInspectionReportSectionProps): React.ReactElement {
  const mutation = useUpdateDomaceClaimInspectionReport(claim.id)

  return (
    <ClaimTextSection
      value={claim.inspectionReport}
      heading={m.claims_detail_section_inspection_report()}
      hint={m.claims_detail_inspection_report_hint_domace()}
      emptyText={m.claims_detail_inspection_report_empty()}
      textareaId="claimInspectionReport"
      canEdit={canEdit}
      isSaving={mutation.isPending}
      onSave={(inspectionReport) => mutation.mutateAsync({ inspectionReport })}
    />
  )
}
