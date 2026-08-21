import { m } from '@mr/i18n'
import type { EmotiveClaimDetail } from '@mr/shared'
import type { ReactNode } from 'react'

import { ClaimTextSection } from '../../claims/claim-text-section.js'
import { useUpdateEmotiveClaimInspectionReport } from './use-update-emotive-claim-inspection-report.js'

interface EmotiveClaimInspectionReportSectionProps {
  claim: EmotiveClaimDetail
  canEdit: boolean
  /** Published badge + "Objavi klijentu", in the card's header (handoff §5). */
  headerActions?: ReactNode
}

/**
 * The EN report the client reads on the portal. Saving it for the first time with something in
 * it is Gate A — it is what makes the claim visible to the client at all — so it lives on the
 * Izveštaj tab, beside the badge that says whether the outcome has been published.
 */
export function EmotiveClaimInspectionReportSection({
  claim,
  canEdit,
  headerActions,
}: EmotiveClaimInspectionReportSectionProps): React.ReactElement {
  const mutation = useUpdateEmotiveClaimInspectionReport(claim.id)

  return (
    <ClaimTextSection
      value={claim.inspectionReport}
      heading={m.claims_detail_section_inspection_report_en()}
      hint={m.claims_detail_inspection_report_hint()}
      emptyText={m.claims_detail_inspection_report_empty()}
      textareaId="claimInspectionReport"
      canEdit={canEdit}
      isSaving={mutation.isPending}
      onSave={(inspectionReport) => mutation.mutateAsync({ inspectionReport })}
      {...(headerActions === undefined ? {} : { headerActions })}
    />
  )
}
