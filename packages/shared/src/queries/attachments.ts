import { queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { ClaimKind } from '../enums.js'
import type { AttachmentListResponse } from '../schemas/attachment.schema.js'
import { attachmentKeys } from './attachment-keys.js'

const ATTACHMENTS_LIST_STALE_MS = 30_000

export function attachmentsListOptions(claimKind: ClaimKind, claimId: string) {
  const params = new URLSearchParams({ claimKind, claimId })

  return queryOptions({
    queryKey: attachmentKeys.list(claimKind, claimId),
    queryFn: () => fetchJson<AttachmentListResponse>(`/api/attachments?${params.toString()}`),
    staleTime: ATTACHMENTS_LIST_STALE_MS,
  })
}

export function buildAttachmentDownloadUrl(
  id: string,
  disposition: 'inline' | 'attachment' = 'inline',
): string {
  if (disposition === 'attachment') {
    return `/api/attachments/${id}/download?disposition=attachment`
  }

  return `/api/attachments/${id}/download`
}

/**
 * Grid-sized thumbnail (~400px JPEG, generated at upload). The server falls
 * back to the original when no thumbnail exists (videos, HEIC), so this is
 * always safe to use in photo grids.
 */
export function buildAttachmentThumbnailUrl(id: string): string {
  return `/api/attachments/${id}/download?variant=thumbnail`
}
