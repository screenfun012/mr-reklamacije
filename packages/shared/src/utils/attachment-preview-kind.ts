import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
} from '../constants/limits.js'

export const AttachmentPreviewKind = {
  Image: 'image',
  Pdf: 'pdf',
  Video: 'video',
  Office: 'office',
  Unknown: 'unknown',
} as const

export type AttachmentPreviewKind =
  (typeof AttachmentPreviewKind)[keyof typeof AttachmentPreviewKind]

const OFFICE_MIME_TYPES = new Set<string>([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export function getAttachmentPreviewKind(mimeType: string): AttachmentPreviewKind {
  if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return AttachmentPreviewKind.Image
  }

  if (mimeType === 'application/pdf') {
    return AttachmentPreviewKind.Pdf
  }

  if ((ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return AttachmentPreviewKind.Video
  }

  if (OFFICE_MIME_TYPES.has(mimeType)) {
    return AttachmentPreviewKind.Office
  }

  if ((ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return AttachmentPreviewKind.Unknown
  }

  return AttachmentPreviewKind.Unknown
}

export function formatAttachmentFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
