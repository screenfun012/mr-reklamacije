import {
  isImageAttachmentMimeType,
  MAX_REPORT_IMAGE_WIDTH,
  REPORT_IMAGE_JPEG_QUALITY,
  REPORT_IMAGE_WEBP_QUALITY,
} from '@mr/shared'
import sharp from 'sharp'

import {
  buildAttachmentThumbnailPath,
  type StorageService,
} from '../../infrastructure/storage/storage.interface.js'

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
  } catch {
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
  } catch {
    return null
  }
}

export function shouldGenerateImageThumbnail(mimeType: string): boolean {
  return isImageAttachmentMimeType(mimeType) && mimeType !== 'image/heic'
}

export async function optimizeReportImage(
  data: Buffer,
  mimeType: string,
): Promise<OptimizedReportImage> {
  const resized = sharp(data).rotate().resize({
    width: MAX_REPORT_IMAGE_WIDTH,
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
