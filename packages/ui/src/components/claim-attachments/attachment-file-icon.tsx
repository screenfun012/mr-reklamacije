import { FileSpreadsheet, FileText, FileType, Film, ImageIcon, type LucideIcon } from 'lucide-react'

import { AttachmentPreviewKind, getAttachmentPreviewKind } from '@mr/shared'

export interface AttachmentFileIconProps {
  mimeType: string
  className?: string
}

const ICON_BY_KIND: Record<AttachmentPreviewKind, LucideIcon> = {
  [AttachmentPreviewKind.Image]: ImageIcon,
  [AttachmentPreviewKind.Pdf]: FileText,
  [AttachmentPreviewKind.Video]: Film,
  [AttachmentPreviewKind.Office]: FileSpreadsheet,
  [AttachmentPreviewKind.Unknown]: FileType,
}

export function AttachmentFileIcon({
  mimeType,
  className,
}: AttachmentFileIconProps): React.ReactElement {
  const kind = getAttachmentPreviewKind(mimeType)
  const Icon = ICON_BY_KIND[kind]

  if (
    kind === AttachmentPreviewKind.Office &&
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return <FileType className={className} aria-hidden />
  }

  return <Icon className={className} aria-hidden />
}
