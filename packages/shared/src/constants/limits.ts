export const MAX_FILE_SIZE_MB = 25
export const MAX_FILES_PER_CLAIM = 50
export const MAX_TOTAL_SIZE_PER_CLAIM_MB = 500

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const

export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'] as const

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

export const MAX_VIDEO_DURATION_SECONDS = 120
