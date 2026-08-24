import type { ClaimKind, IntakeDocumentKind } from '@mr/shared'

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

/**
 * The two documents an intake order can carry — the reception sheet and the handover sheet.
 *
 * Re-exported from the wire rather than declared twice: the screen asks for a paper by this same
 * value, and two lists of kinds would let one side learn about a third one the other never heard of.
 */
export type { IntakeDocumentKind } from '@mr/shared'

/** The intake keeps `document.pdf` it has always had — renaming it would orphan every sealed file. */
const INTAKE_DOCUMENT_FILE_NAME: Record<IntakeDocumentKind, string> = {
  intake: 'document.pdf',
  handover: 'handover.pdf',
}

/**
 * Storage key for a signed order document. Beside the order's photos and deliberately NOT an
 * `attachments` row: intake photos are recognised solely by `intake_order_id IS NOT NULL`, and five
 * places count them that way — a PDF among them would be counted as a photograph.
 *
 * One key per order AND kind, so re-producing a document that failed half way overwrites rather
 * than accumulating orphans. A produced document is never re-rendered (the seal would change), so
 * the only writer that can reach a given key twice is a retry of a produce that left no row behind.
 */
export function buildIntakeDocumentStoragePath(orderId: string, kind: IntakeDocumentKind): string {
  return `intake/${orderId}/${INTAKE_DOCUMENT_FILE_NAME[kind]}`
}

export interface SubmissionAttachmentPathInput {
  readonly submissionId: string
  readonly attachmentId: string
  readonly extension: string
}

export interface ChatAttachmentPathInput {
  readonly conversationId: string
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

/**
 * Storage key for a file sent in a chat message. Keyed by the room, not the message: a room is
 * what gets erased in one go, so its objects are swept in one prefix.
 */
export function buildChatAttachmentStoragePath(input: ChatAttachmentPathInput): string {
  return `chat/${input.conversationId}/${input.attachmentId}.${input.extension}`
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
