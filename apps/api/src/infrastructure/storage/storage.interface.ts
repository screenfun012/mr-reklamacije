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
