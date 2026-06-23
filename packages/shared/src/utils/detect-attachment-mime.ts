import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
} from '../constants/limits.js'

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
] as const

export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]

const ALLOWED_SET = new Set<string>(ALLOWED_ATTACHMENT_MIME_TYPES)

export function isAllowedAttachmentMimeType(
  mimeType: string,
): mimeType is AllowedAttachmentMimeType {
  return ALLOWED_SET.has(mimeType)
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function isZipContainer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

function detectOfficeOpenXml(bytes: Uint8Array): AllowedAttachmentMimeType | null {
  if (!isZipContainer(bytes)) {
    return null
  }

  const sample = readAscii(bytes, 0, Math.min(bytes.length, 4096))
  if (sample.includes('word/')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (sample.includes('xl/')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }

  return null
}

function detectHeic(bytes: Uint8Array): AllowedAttachmentMimeType | null {
  if (bytes.length < 12) {
    return null
  }

  const boxType = readAscii(bytes, 4, 4)
  if (boxType !== 'ftyp') {
    return null
  }

  const brand = readAscii(bytes, 8, 4).toLowerCase()
  if (brand.startsWith('heic') || brand.startsWith('heix') || brand.startsWith('mif1')) {
    return 'image/heic'
  }

  return null
}

function detectMp4OrMov(bytes: Uint8Array): AllowedAttachmentMimeType | null {
  if (bytes.length < 12) {
    return null
  }

  if (readAscii(bytes, 4, 4) !== 'ftyp') {
    return null
  }

  const brand = readAscii(bytes, 8, 4).toLowerCase()
  if (brand.startsWith('qt')) {
    return 'video/quicktime'
  }

  return 'video/mp4'
}

/** Detect MIME type from file magic bytes for supported attachment formats. */
export function detectAttachmentMimeType(bytes: Uint8Array): AllowedAttachmentMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }

  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === 'RIFF' &&
    readAscii(bytes, 8, 4) === 'WEBP'
  ) {
    return 'image/webp'
  }

  const heic = detectHeic(bytes)
  if (heic !== null) {
    return heic
  }

  if (bytes.length >= 5 && readAscii(bytes, 0, 5) === '%PDF-') {
    return 'application/pdf'
  }

  const video = detectMp4OrMov(bytes)
  if (video !== null) {
    return video
  }

  const office = detectOfficeOpenXml(bytes)
  if (office !== null) {
    return office
  }

  return null
}

export function extensionForMimeType(mimeType: AllowedAttachmentMimeType): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/heic':
      return 'heic'
    case 'video/mp4':
      return 'mp4'
    case 'video/quicktime':
      return 'mov'
    case 'application/pdf':
      return 'pdf'
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx'
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx'
    default: {
      const exhaustive: never = mimeType
      throw new Error(`Unhandled MIME type: ${exhaustive}`)
    }
  }
}

export function isImageAttachmentMimeType(mimeType: string): boolean {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
}
