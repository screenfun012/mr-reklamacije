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
      findings={claim.findings ?? []}
      canEdit={canEdit}
      isSaving={mutation.isPending}
      onSave={(findings) => mutation.mutateAsync({ findings })}
    />
  )
}
