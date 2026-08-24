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
 * ⚠ Written as a pino-shaped JSON line on STDOUT, and both halves of that matter.
 *
 * `console.warn` writes to stderr, and Railway files everything on stderr under "Error logs" — so
 * the first version of this put three warnings straight into the panel a person goes to when
 * something is actually wrong. A warning that hides real errors is worse than no warning.
 *
 * Hand-shaped rather than the app's logger because this file is pure image machinery with no
 * dependencies, reached through a pipeline that four services share; threading a logger down to it
 * would change five signatures to carry one line. `level: 40` is pino's `warn`, which is what makes
 * Railway file it as a warning rather than guessing from the stream.
 */
function warn(message: string, error: unknown): void {
  console.log(
    JSON.stringify({
      level: 40,
      time: Date.now(),
      name: 'attachments',
      msg: message,
      err: error instanceof Error ? error.message : String(error),
    }),
  )
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
