import type { AttachmentListItem } from '@mr/shared'
import { buildAttachmentDownloadUrl } from '@mr/shared'
import { lazy, Suspense, useMemo } from 'react'

import {
  isSpreadsheetMimeType,
  isWordMimeType,
  OFFICE_PREVIEW_MAX_BYTES,
} from './office-preview-constants.js'
import { OfficePreviewFallback } from './office-preview-fallback.js'
import { OfficePreviewLoading } from './office-preview-loading.js'

const LazyXlsxOfficePreview = lazy(() => import('./xlsx-office-preview.js'))
const LazyDocxOfficePreview = lazy(() => import('./docx-office-preview.js'))

export interface OfficeAttachmentPreviewProps {
  attachment: AttachmentListItem
}

export function OfficeAttachmentPreview({
  attachment,
}: OfficeAttachmentPreviewProps): React.ReactElement {
  const fetchUrl = useMemo(
    () => buildAttachmentDownloadUrl(attachment.id, 'inline'),
    [attachment.id],
  )

  if (attachment.fileSizeBytes > OFFICE_PREVIEW_MAX_BYTES) {
    return <OfficePreviewFallback mimeType={attachment.mimeType} variant="too_large" />
  }

  if (isSpreadsheetMimeType(attachment.mimeType)) {
    return (
      <Suspense fallback={<OfficePreviewLoading />}>
        <LazyXlsxOfficePreview fetchUrl={fetchUrl} />
      </Suspense>
    )
  }

  if (isWordMimeType(attachment.mimeType)) {
    return (
      <Suspense fallback={<OfficePreviewLoading />}>
        <LazyDocxOfficePreview fetchUrl={fetchUrl} />
      </Suspense>
    )
  }

  return <OfficePreviewFallback mimeType={attachment.mimeType} variant="error" />
}

export function isOfficeAttachmentMimeType(mimeType: string): boolean {
  return isSpreadsheetMimeType(mimeType) || isWordMimeType(mimeType)
}
