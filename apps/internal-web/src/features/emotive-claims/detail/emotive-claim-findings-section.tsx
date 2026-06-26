import type { EmotiveClaimDetail } from '@mr/shared'

import { ClaimFindingsSection } from '../../claims/claim-findings-section.js'
import { useUpdateEmotiveClaimFindings } from './use-update-emotive-claim-findings.js'

interface EmotiveClaimFindingsSectionProps {
  claim: EmotiveClaimDetail
  canEdit: boolean
}

export function EmotiveClaimFindingsSection({
  claim,
  canEdit,
}: EmotiveClaimFindingsSectionProps): React.ReactElement {
  const mutation = useUpdateEmotiveClaimFindings(claim.id)

  return (
    <ClaimFindingsSection
      internalNotes={claim.internalNotes}
      canEdit={canEdit}
      isSaving={mutation.isPending}
      onSave={(internalNotes) => mutation.mutateAsync({ internalNotes })}
    />
  )
}
