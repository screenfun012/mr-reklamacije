export const MAX_FILE_SIZE_MB = 25
export const MAX_FILES_PER_CLAIM = 50
export const MAX_REPORT_IMAGES_PER_CLAIM = 100
export const MAX_TOTAL_SIZE_PER_CLAIM_MB = 500

/** Security and push-cost ceiling shared by the auth hook and push fan-out. */
export const MAX_ACTIVE_SESSIONS_PER_USER = 5

/** Max stored width for report images after server-side optimization. */
export const MAX_REPORT_IMAGE_WIDTH = 1920

/**
 * Max stored edge for claim-attachment photos. Every uploaded image is
 * server-side recompressed (a 5–10 MB phone photo stores as ~0.3–0.7 MB with
 * no visible quality loss); only the optimized bytes are kept.
 */
export const MAX_ATTACHMENT_IMAGE_WIDTH = 2048

export const REPORT_IMAGE_JPEG_QUALITY = 80
export const REPORT_IMAGE_WEBP_QUALITY = 80

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
