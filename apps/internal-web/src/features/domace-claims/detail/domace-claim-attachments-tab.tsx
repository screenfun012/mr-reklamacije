import { ClaimKind, type AttachmentListItem } from '@mr/shared'
import { getRouteApi } from '@tanstack/react-router'

import { authClient } from '~/lib/auth-client.js'

import { ClaimAttachmentsTab } from '../../attachments/claim-attachments-tab.js'

export interface DomaceClaimAttachmentsTabProps {
  claimId: string
}

const rootRoute = getRouteApi('__root__')

export function DomaceClaimAttachmentsTab({
  claimId,
}: DomaceClaimAttachmentsTabProps): React.ReactElement {
  const { authSession } = rootRoute.useRouteContext()
  const { data: session } = authClient.useSession()
  const permissions = authSession?.user?.permissions ?? []
  const userId = session?.user?.id

  const canUpload = permissions.includes('attachments.upload')
  const canDeleteAny = permissions.includes('attachments.delete_any')
  const canDeleteOwn = permissions.includes('attachments.delete_own')

  const canDeleteItem = (item: AttachmentListItem): boolean => {
    if (canDeleteAny) {
      return true
    }

    return canDeleteOwn && item.uploadedBy === userId
  }

  return (
    <ClaimAttachmentsTab
      claimKind={ClaimKind.Domace}
      claimId={claimId}
      canUpload={canUpload}
      canDeleteItem={canDeleteItem}
    />
  )
}
