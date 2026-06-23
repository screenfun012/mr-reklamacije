import type { ClaimKind } from '../enums.js'

export const attachmentKeys = {
  all: ['attachments'] as const,
  lists: () => [...attachmentKeys.all, 'list'] as const,
  list: (claimKind: ClaimKind, claimId: string) =>
    [...attachmentKeys.lists(), claimKind, claimId] as const,
}
