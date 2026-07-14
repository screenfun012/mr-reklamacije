import {
  MAX_FILE_SIZE_MB,
  MAX_TOTAL_SIZE_PER_CLAIM_MB,
  detectAttachmentMimeType,
  extensionForMimeType,
  type AllowedAttachmentMimeType,
} from '@mr/shared'
import { createHash } from 'node:crypto'

import { PayloadTooLargeError, UnsupportedMediaTypeError } from '../../core/errors/domain-errors.js'
import type { StorageService } from '../../infrastructure/storage/storage.interface.js'
import {
  generateImageThumbnail,
  optimizeAttachmentImage,
  readImageDimensions,
  shouldGenerateImageThumbnail,
  type OptimizedReportImage,
} from './attachment-image-processing.js'

export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
export const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_PER_CLAIM_MB * 1024 * 1024

export interface AttachmentUploadFileInput {
  readonly fileName: string
  readonly data: Buffer
  readonly caption?: string | null
}

/** Recompression can change the format (e.g. png → jpeg) — keep the display name honest. */
export function alignFileNameExtension(
  fileName: string,
  mimeType: AllowedAttachmentMimeType,
): string {
  const extension = extensionForMimeType(mimeType)
  if (fileName.toLowerCase().endsWith(`.${extension}`)) {
    return fileName
  }
  const dotIndex = fileName.lastIndexOf('.')
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  return `${base}.${extension}`
}

export interface ProcessedUploadFile {
  readonly storedData: Buffer
  readonly storedMime: AllowedAttachmentMimeType
  readonly contentSha256: string
  readonly optimized: OptimizedReportImage | null
}

/**
 * The shared per-file processing stage (magic-byte MIME check → size limit → image
 * recompression → content hash). Used by both claim and submission uploads so the one hardened
 * pipeline runs everywhere; the caller owns target-specific concerns (dedup scope, storage path,
 * total-size cap, row insert).
 */
export async function processUploadFile(
  file: AttachmentUploadFileInput,
): Promise<ProcessedUploadFile> {
  if (file.data.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new PayloadTooLargeError(`File exceeds ${MAX_FILE_SIZE_MB} MB limit`)
  }

  const detectedMime = detectAttachmentMimeType(new Uint8Array(file.data))
  if (detectedMime === null) {
    throw new UnsupportedMediaTypeError('Unsupported file type')
  }

  // Photos are recompressed before anything else (dedupe hash, storage, limits) so only the
  // optimized bytes ever exist in the system.
  const optimized = await optimizeAttachmentImage(file.data, detectedMime)
  const storedData = optimized?.data ?? file.data
  const storedMime = optimized?.mimeType ?? detectedMime
  const contentSha256 = createHash('sha256').update(storedData).digest('hex')

  return { storedData, storedMime, contentSha256, optimized }
}

export interface StoredFileResult {
  readonly width: number | null
  readonly height: number | null
  readonly thumbnailPath: string | null
}

/** Writes the (already optimized) bytes to storage and generates a thumbnail when applicable. */
export async function writeStoredFile(
  storage: StorageService,
  params: {
    storagePath: string
    storedData: Buffer
    storedMime: AllowedAttachmentMimeType
    optimized: OptimizedReportImage | null
  },
): Promise<StoredFileResult> {
  await storage.upload({
    path: params.storagePath,
    data: params.storedData,
    mimeType: params.storedMime,
  })

  const dimensions =
    params.optimized !== null
      ? { width: params.optimized.width, height: params.optimized.height }
      : shouldGenerateImageThumbnail(params.storedMime)
        ? await readImageDimensions(params.storedData)
        : null

  const thumbnailPath =
    dimensions !== null && shouldGenerateImageThumbnail(params.storedMime)
      ? await generateImageThumbnail(storage, params.storagePath, params.storedData)
      : null

  return {
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    thumbnailPath,
  }
}
