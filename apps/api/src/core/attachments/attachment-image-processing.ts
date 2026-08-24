import {
  isImageAttachmentMimeType,
  MAX_ATTACHMENT_IMAGE_WIDTH,
  MAX_REPORT_IMAGE_WIDTH,
  REPORT_IMAGE_JPEG_QUALITY,
  REPORT_IMAGE_WEBP_QUALITY,
} from '@mr/shared'
import sharp from 'sharp'

import {
  buildAttachmentThumbnailPath,
  type StorageService,
} from '../../infrastructure/storage/storage.interface.js'

/**
 * These three used to swallow their failures whole.
 *
 * Each fallback is right — no dimensions, no thumbnail, or the original bytes — but all three are
 * silent, and the third means a full-size photo is stored instead of a small one. That is a cost
 * that shows up on the hosting bill months later with nothing in the logs to explain it.
 *
 * ⚠ `console` rather than the app's logger on purpose: this file is pure image machinery with no
 * dependencies, called from three modules, and threading a logger through all of them to reach a
 * warning would be the wrong trade. Railway captures stderr.
 */
function warn(message: string, error: unknown): void {
  console.warn(`[attachments] ${message}:`, error)
}

export interface OptimizedReportImage {
  readonly data: Buffer
  readonly mimeType: 'image/jpeg' | 'image/webp'
  readonly width: number
  readonly height: number
}

export interface ImageDimensions {
  readonly width: number
  readonly height: number
}

export async function readImageDimensions(data: Buffer): Promise<ImageDimensions | null> {
  try {
    const metadata = await sharp(data).metadata()
    if (metadata.width === undefined || metadata.height === undefined) {
      return null
    }

    return { width: metadata.width, height: metadata.height }
  } catch (error) {
    // The caller is right to carry on without dimensions; it just must not happen unnoticed.
    warn('could not read image dimensions', error)
    return null
  }
}

export async function generateImageThumbnail(
  storage: StorageService,
  storagePath: string,
  data: Buffer,
): Promise<string | null> {
  try {
    const thumbnailPath = buildAttachmentThumbnailPath(storagePath)
    const thumbnail = await sharp(data)
      .rotate()
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()

    await storage.upload({
      path: thumbnailPath,
      data: thumbnail,
      mimeType: 'image/jpeg',
    })

    return thumbnailPath
  } catch (error) {
    warn('could not generate a thumbnail', error)
    return null
  }
}

export function shouldGenerateImageThumbnail(mimeType: string): boolean {
  return isImageAttachmentMimeType(mimeType) && mimeType !== 'image/heic'
}

async function optimizeImage(
  data: Buffer,
  mimeType: string,
  maxWidth: number,
): Promise<OptimizedReportImage> {
  const resized = sharp(data).rotate().resize({
    width: maxWidth,
    fit: 'inside',
    withoutEnlargement: true,
  })

  if (mimeType === 'image/webp') {
    const output = await resized.webp({ quality: REPORT_IMAGE_WEBP_QUALITY }).toBuffer({
      resolveWithObject: true,
    })

    return {
      data: output.data,
      mimeType: 'image/webp',
      width: output.info.width,
      height: output.info.height,
    }
  }

  const output = await resized
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: REPORT_IMAGE_JPEG_QUALITY })
    .toBuffer({ resolveWithObject: true })

  return {
    data: output.data,
    mimeType: 'image/jpeg',
    width: output.info.width,
    height: output.info.height,
  }
}

export async function optimizeReportImage(
  data: Buffer,
  mimeType: string,
): Promise<OptimizedReportImage> {
  return optimizeImage(data, mimeType, MAX_REPORT_IMAGE_WIDTH)
}

/**
 * Recompresses a claim-attachment photo for storage (max edge + quality 80) —
 * only the optimized bytes are kept, which is what caps storage growth from
 * multi-MB phone photos. Returns `null` when the file should be stored as-is:
 * not an image, HEIC (sharp lacks a decoder here), or a decode failure — a
 * broken image must not block the upload.
 */
export async function optimizeAttachmentImage(
  data: Buffer,
  mimeType: string,
): Promise<OptimizedReportImage | null> {
  if (!shouldGenerateImageThumbnail(mimeType)) {
    return null
  }

  try {
    return await optimizeImage(data, mimeType, MAX_ATTACHMENT_IMAGE_WIDTH)
  } catch (error) {
    // Falling back to the original bytes is correct — a photo that will not recompress must still
    // be stored — but it costs a full-size file, so it is worth being able to see it happening.
    warn('could not recompress an image, storing it as it arrived', error)
    return null
  }
}
