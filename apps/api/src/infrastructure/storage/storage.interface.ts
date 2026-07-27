import type { ClaimKind } from '@mr/shared'

export interface UploadOpts {
  readonly path: string
  readonly data: Buffer
  readonly mimeType: string
}

export interface StoredFile {
  readonly path: string
  readonly size: number
  readonly mimeType: string
}

export interface FileMetadata {
  readonly size: number
  readonly mimeType?: string
}

export interface StorageService {
  upload(opts: UploadOpts): Promise<StoredFile>
  read(path: string): Promise<Buffer>
  /** Streamed read for downloads — the file never sits fully on the heap. */
  readStream(path: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number }>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  getMetadata(path: string): Promise<FileMetadata>
}

export interface AttachmentPathInput {
  readonly claimKind: ClaimKind
  readonly claimYear: number
  readonly claimId: string
  readonly attachmentId: string
  readonly extension: string
}

export function buildAttachmentStoragePath(input: AttachmentPathInput): string {
  return `${input.claimKind}/${input.claimYear}/${input.claimId}/${input.attachmentId}.${input.extension}`
}

export interface SubmissionAttachmentPathInput {
  readonly submissionId: string
  readonly attachmentId: string
  readonly extension: string
}

export interface IntakeAttachmentPathInput {
  readonly orderId: string
  readonly attachmentId: string
  readonly extension: string
}

/**
 * Storage key for a vehicle-intake photo. No year segment: an intake order is short-lived
 * paperwork rather than an archive keyed by claim year (docs/25).
 */
export function buildIntakeAttachmentStoragePath(input: IntakeAttachmentPathInput): string {
  return `intake/${input.orderId}/${input.attachmentId}.${input.extension}`
}

/** Storage key for a portal-submission attachment (no claim year — a submission is pre-claim). */
export function buildSubmissionAttachmentStoragePath(input: SubmissionAttachmentPathInput): string {
  return `submissions/${input.submissionId}/${input.attachmentId}.${input.extension}`
}

export function buildAttachmentThumbnailPath(storagePath: string): string {
  const segments = storagePath.split('/')
  const fileName = segments.pop()
  if (fileName === undefined) {
    throw new Error('Invalid attachment storage path')
  }

  const attachmentId = fileName.replace(/\.[^.]+$/, '')
  return [...segments, '_thumb', `${attachmentId}.jpg`].join('/')
}

export function sanitizeUploadFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop() ?? 'upload'
  const cleaned = baseName.replace(/[^\w.\- ()[\]]+/g, '_').trim()
  return cleaned.length > 0 ? cleaned.slice(0, 255) : 'upload'
}
