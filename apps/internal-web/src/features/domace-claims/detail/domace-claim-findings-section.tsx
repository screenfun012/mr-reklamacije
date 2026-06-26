import type { DomaceClaimDetail } from '@mr/shared'

import { ClaimFindingsSection } from '../../claims/claim-findings-section.js'
import { useUpdateDomaceClaimFindings } from './use-update-domace-claim-findings.js'

interface DomaceClaimFindingsSectionProps {
  claim: DomaceClaimDetail
  canEdit: boolean
}

export function DomaceClaimFindingsSection({
  claim,
  canEdit,
}: DomaceClaimFindingsSectionProps): React.ReactElement {
  const mutation = useUpdateDomaceClaimFindings(claim.id)

  return (
    <ClaimFindingsSection
      internalNotes={claim.internalNotes}
      canEdit={canEdit}
      isSaving={mutation.isPending}
      onSave={(internalNotes) => mutation.mutateAsync({ internalNotes })}
    />
  )
}
