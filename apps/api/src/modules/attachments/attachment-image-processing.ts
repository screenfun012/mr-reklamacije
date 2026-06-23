import sharp from 'sharp'

import {
  buildAttachmentThumbnailPath,
  type StorageService,
} from '../../infrastructure/storage/storage.interface.js'
import { isImageAttachmentMimeType } from '@mr/shared'

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
