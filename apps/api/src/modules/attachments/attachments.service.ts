import {
  AttachmentPurpose,
  AttachmentVisibility,
  AuditAction,
  ClaimKind,
  ClientSubmissionStatus,
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_CLAIM,
  MAX_REPORT_IMAGES_PER_CLAIM,
  MAX_TOTAL_SIZE_PER_CLAIM_MB,
  detectAttachmentMimeType,
  extensionForMimeType,
  isImageAttachmentMimeType,
  type AllowedAttachmentMimeType,
} from '@mr/shared'
import { createHash, randomUUID } from 'node:crypto'

import { assertClaimEditable } from '../../core/claims/claim-lock.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '../../core/errors/domain-errors.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { ClaimContextPort } from '../../core/ports/claim-context-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type {
  SubmissionAccessInfo,
  SubmissionAccessPort,
} from '../../core/ports/submission-access-port.js'
import {
  buildSignedAttachmentUrl,
  verifySignedAttachmentToken,
} from '../../infrastructure/storage/local-volume-storage.js'
import {
  buildAttachmentStoragePath,
  buildSubmissionAttachmentStoragePath,
  sanitizeUploadFileName,
  type StorageService,
} from '../../infrastructure/storage/storage.interface.js'
import {
  generateImageThumbnail,
  optimizeAttachmentImage,
  optimizeReportImage,
  readImageDimensions,
  shouldGenerateImageThumbnail,
  type OptimizedReportImage,
} from './attachment-image-processing.js'
import { AttachmentsRepository } from './attachments.repository.js'
import type {
  AttachmentsActor,
  AttachmentsAuditContext,
  AttachmentsViewScope,
  SubmissionAttachmentItem,
  SubmissionAttachmentUploadResult,
} from './attachments.types.js'
import type {
  AttachmentListItem,
  AttachmentListQuery,
  AttachmentListResponse,
  AttachmentSignedUrlResponse,
  AttachmentUploadResult,
} from './attachments.validators.js'

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_PER_CLAIM_MB * 1024 * 1024

/** Recompression can change the format (e.g. png → jpeg) — keep the display name honest. */
function alignFileNameExtension(fileName: string, mimeType: AllowedAttachmentMimeType): string {
  const extension = extensionForMimeType(mimeType)
  if (fileName.toLowerCase().endsWith(`.${extension}`)) {
    return fileName
  }
  const dotIndex = fileName.lastIndexOf('.')
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  return `${base}.${extension}`
}

export interface AttachmentUploadFileInput {
  readonly fileName: string
  readonly data: Buffer
  readonly caption?: string | null
}

export interface AttachmentUploadInput {
  readonly claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace
  readonly claimId: string
  readonly visibility:
    | typeof AttachmentVisibility.Internal
    | typeof AttachmentVisibility.ClientVisible
  readonly files: readonly AttachmentUploadFileInput[]
}

export interface ReportImageUploadInput {
  readonly claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace
  readonly claimId: string
  readonly file: AttachmentUploadFileInput
}

export interface ReportImageUploadResult {
  readonly id: string
  readonly url: string
}

function resolveViewScope(actor: AttachmentsActor): AttachmentsViewScope {
  if (actor.permissions.includes('attachments.view_internal')) {
    return { type: 'internal' }
  }

  if (actor.permissions.includes('attachments.view_client_visible')) {
    return { type: 'client_visible_only' }
  }

  throw new ForbiddenError()
}

/**
 * Whether a claim attachment is visible to portal clients — the TS twin of the
 * repository's SQL visibilityFilter client clause: a photo (image) is always
 * client-visible, plus anything explicitly marked client_visible. Upload/delete
 * targets are always claim attachments, so purpose is not needed here. Keep in
 * sync with attachments.repository.ts visibilityFilter.
 */
function isClientVisibleClaimAttachment(item: { visibility: string; mimeType: string }): boolean {
  return (
    item.visibility === AttachmentVisibility.ClientVisible ||
    isImageAttachmentMimeType(item.mimeType)
  )
}

export class AttachmentsService {
  constructor(
    private readonly repo: AttachmentsRepository,
    private readonly storage: StorageService,
    private readonly claimContext: ClaimContextPort,
    private readonly audit: AuditPort,
    private readonly events: EventBus,
    private readonly signingSecret: string,
    private readonly apiBaseUrl: string,
    private readonly submissionAccess: SubmissionAccessPort,
  ) {}

  /**
   * Attachment changes ride the claim-updated signal so internal views refresh.
   * The owning customer's portal is only signalled when the change is actually
   * client-visible (a photo) — uploading/deleting an INTERNAL document never
   * wakes portal clients into a needless refetch.
   */
  private async publishClaimAttachmentsChanged(
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace,
    claimId: string,
    clientVisible: boolean,
  ): Promise<void> {
    const customerId =
      clientVisible && claimKind === ClaimKind.Emotive
        ? await this.repo.findEmotiveClaimCustomerId(claimId)
        : null
    this.events.publishClaimUpdated({ kind: claimKind, id: claimId }, customerId)
  }

  /**
   * The shared per-file processing stage (magic-byte MIME check → size limit → image
   * recompression → content hash). Used by both claim and submission uploads so the one hardened
   * pipeline runs everywhere; the caller owns target-specific concerns (dedup scope, storage path,
   * total-size cap, row insert).
   */
  private async processUploadFile(file: AttachmentUploadFileInput): Promise<{
    storedData: Buffer
    storedMime: AllowedAttachmentMimeType
    contentSha256: string
    optimized: OptimizedReportImage | null
  }> {
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

  /** Writes the (already optimized) bytes to storage and generates a thumbnail when applicable. */
  private async writeStoredFile(params: {
    storagePath: string
    storedData: Buffer
    storedMime: AllowedAttachmentMimeType
    optimized: OptimizedReportImage | null
  }): Promise<{ width: number | null; height: number | null; thumbnailPath: string | null }> {
    await this.storage.upload({
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
        ? await generateImageThumbnail(this.storage, params.storagePath, params.storedData)
        : null

    return {
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      thumbnailPath,
    }
  }

  async list(query: AttachmentListQuery, actor: AttachmentsActor): Promise<AttachmentListResponse> {
    const scope = resolveViewScope(actor)
    await this.claimContext.loadClaimContext(query.claimKind, query.claimId, actor)
    const items = await this.repo.listByClaim(query, scope)
    return { items }
  }

  async findById(id: string, actor: AttachmentsActor): Promise<AttachmentListItem> {
    const scope = resolveViewScope(actor)
    const attachment = await this.repo.findById(id, scope)
    if (attachment === null) {
      throw new NotFoundError('Attachment', id)
    }

    await this.claimContext.loadClaimContext(attachment.claimKind, attachment.claimId, actor)
    return attachment
  }

  async getSignedUrl(id: string, actor: AttachmentsActor): Promise<AttachmentSignedUrlResponse> {
    await this.findById(id, actor)
    return buildSignedAttachmentUrl(this.apiBaseUrl, id, this.signingSecret)
  }

  /**
   * Access-checked download metadata. `variant: 'thumbnail'` serves the
   * pre-generated grid thumbnail (falls back to the original when none
   * exists). The ETag derives from the stored content hash — content is
   * immutable, so clients can revalidate with a body-less 304 instead of
   * re-downloading photos on every view.
   */
  async getDownloadMeta(
    id: string,
    actor: AttachmentsActor,
    variant: 'original' | 'thumbnail',
  ): Promise<{
    storagePath: string
    mimeType: string
    fileName: string
    etag: string | null
  }> {
    await this.findById(id, actor)
    const row = await this.repo.findRawById(id)
    if (row === null) {
      throw new NotFoundError('Attachment', id)
    }

    const thumbnailPath = variant === 'thumbnail' ? row.thumbnailPath : null
    return {
      storagePath: thumbnailPath ?? row.storagePath,
      // Thumbnails are always generated as JPEG (see generateImageThumbnail).
      mimeType: thumbnailPath !== null ? 'image/jpeg' : row.mimeType,
      fileName: row.fileName,
      etag:
        row.contentSha256 === null
          ? null
          : `"${row.contentSha256}${thumbnailPath !== null ? '-thumb' : ''}"`,
    }
  }

  /** Streamed file body for a path previously resolved via getDownloadMeta/raw. */
  async openDownloadStream(
    storagePath: string,
  ): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
    return this.storage.readStream(storagePath)
  }

  async getRawDownloadMeta(
    id: string,
    expiresAtEpochSeconds: number,
    token: string,
  ): Promise<{ storagePath: string; mimeType: string; fileName: string }> {
    if (!verifySignedAttachmentToken(id, expiresAtEpochSeconds, token, this.signingSecret)) {
      throw new ForbiddenError('Invalid or expired signed URL')
    }

    const row = await this.repo.findRawById(id)
    if (row === null) {
      throw new NotFoundError('Attachment', id)
    }

    return {
      storagePath: row.storagePath,
      mimeType: row.mimeType,
      fileName: row.fileName,
    }
  }

  async upload(
    input: AttachmentUploadInput,
    actor: AttachmentsActor,
    auditContext: AttachmentsAuditContext,
  ): Promise<AttachmentUploadResult> {
    if (!actor.permissions.includes('attachments.upload')) {
      throw new ForbiddenError()
    }

    const claim = await this.claimContext.loadClaimContext(input.claimKind, input.claimId, actor)
    assertClaimEditable(claim)

    const stats = await this.repo.countActiveForClaim(input.claimKind, input.claimId)
    if (stats.count + input.files.length > MAX_FILES_PER_CLAIM) {
      throw new ConflictError(`Claim attachment limit reached (${MAX_FILES_PER_CLAIM})`)
    }

    const items: AttachmentListItem[] = []
    let skippedDuplicates = 0
    let runningTotalBytes = stats.totalBytes

    for (const file of input.files) {
      const { storedData, storedMime, contentSha256, optimized } =
        await this.processUploadFile(file)

      if (runningTotalBytes + storedData.byteLength > MAX_TOTAL_SIZE_BYTES) {
        throw new PayloadTooLargeError(
          `Claim attachment total size exceeds ${MAX_TOTAL_SIZE_PER_CLAIM_MB} MB`,
        )
      }

      const existing = await this.repo.findByContentHash(
        input.claimKind,
        input.claimId,
        contentSha256,
        AttachmentPurpose.ClaimAttachment,
      )
      if (existing !== null) {
        items.push(existing)
        skippedDuplicates += 1
        continue
      }

      const attachmentId = randomUUID()
      const extension = extensionForMimeType(storedMime)
      const storagePath = buildAttachmentStoragePath({
        claimKind: input.claimKind,
        claimYear: claim.claimYear,
        claimId: input.claimId,
        attachmentId,
        extension,
      })

      const { width, height, thumbnailPath } = await this.writeStoredFile({
        storagePath,
        storedData,
        storedMime,
        optimized,
      })

      const created = await this.repo.insert({
        claimKind: input.claimKind,
        claimId: input.claimId,
        fileName: alignFileNameExtension(sanitizeUploadFileName(file.fileName), storedMime),
        storagePath,
        mimeType: storedMime,
        fileSizeBytes: storedData.byteLength,
        contentSha256,
        width,
        height,
        durationSeconds: null,
        thumbnailPath,
        caption: file.caption ?? null,
        visibility: input.visibility,
        purpose: AttachmentPurpose.ClaimAttachment,
        uploadedBy: actor.id,
      })

      runningTotalBytes += storedData.byteLength

      await this.audit.log({
        entityType: 'attachment',
        entityId: created.id,
        action: AuditAction.Create,
        actorUserId: auditContext.actorUserId,
        actorIp: auditContext.actorIp,
        actorUserAgent: auditContext.actorUserAgent,
        context: {
          claimKind: input.claimKind,
          claimId: input.claimId,
          fileName: created.fileName,
        },
      })

      items.push(created)
    }

    if (items.length > 0) {
      // Only signal the portal when a client-visible photo was added.
      await this.publishClaimAttachmentsChanged(
        input.claimKind,
        input.claimId,
        items.some(isClientVisibleClaimAttachment),
      )
    }

    return { items, skippedDuplicates }
  }

  async uploadReportImage(
    input: ReportImageUploadInput,
    actor: AttachmentsActor,
    auditContext: AttachmentsAuditContext,
  ): Promise<ReportImageUploadResult> {
    if (!actor.permissions.includes('claim_reports.update')) {
      throw new ForbiddenError()
    }

    const claim = await this.claimContext.loadClaimContext(input.claimKind, input.claimId, actor)
    assertClaimEditable(claim)

    const reportImageCount = await this.repo.countActiveReportImagesForClaim(
      input.claimKind,
      input.claimId,
    )
    if (reportImageCount >= MAX_REPORT_IMAGES_PER_CLAIM) {
      throw new ConflictError(`Report image limit reached (${MAX_REPORT_IMAGES_PER_CLAIM})`)
    }

    const file = input.file
    if (file.data.byteLength > MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeError(`File exceeds ${MAX_FILE_SIZE_MB} MB limit`)
    }

    const detectedMime = detectAttachmentMimeType(new Uint8Array(file.data))
    if (detectedMime === null || !isImageAttachmentMimeType(detectedMime)) {
      throw new UnsupportedMediaTypeError('Unsupported image type')
    }

    const optimized = await optimizeReportImage(file.data, detectedMime)
    const storedMime = optimized.mimeType

    const contentSha256 = createHash('sha256').update(optimized.data).digest('hex')
    const existing = await this.repo.findByContentHash(
      input.claimKind,
      input.claimId,
      contentSha256,
      AttachmentPurpose.ReportImage,
    )
    if (existing !== null) {
      return {
        id: existing.id,
        url: `/api/attachments/${existing.id}/download`,
      }
    }

    const attachmentId = randomUUID()
    const extension = extensionForMimeType(storedMime)
    const storagePath = buildAttachmentStoragePath({
      claimKind: input.claimKind,
      claimYear: claim.claimYear,
      claimId: input.claimId,
      attachmentId,
      extension,
    })

    await this.storage.upload({
      path: storagePath,
      data: optimized.data,
      mimeType: storedMime,
    })

    const thumbnailPath = shouldGenerateImageThumbnail(storedMime)
      ? await generateImageThumbnail(this.storage, storagePath, optimized.data)
      : null

    const created = await this.repo.insert({
      claimKind: input.claimKind,
      claimId: input.claimId,
      fileName: sanitizeUploadFileName(file.fileName),
      storagePath,
      mimeType: storedMime,
      fileSizeBytes: optimized.data.byteLength,
      contentSha256,
      width: optimized.width,
      height: optimized.height,
      durationSeconds: null,
      thumbnailPath,
      caption: file.caption ?? null,
      visibility: AttachmentVisibility.Internal,
      purpose: AttachmentPurpose.ReportImage,
      uploadedBy: actor.id,
    })

    await this.audit.log({
      entityType: 'attachment',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      context: {
        claimKind: input.claimKind,
        claimId: input.claimId,
        fileName: created.fileName,
        purpose: AttachmentPurpose.ReportImage,
      },
    })

    return {
      id: created.id,
      url: `/api/attachments/${created.id}/download`,
    }
  }

  async delete(
    id: string,
    actor: AttachmentsActor,
    auditContext: AttachmentsAuditContext,
  ): Promise<void> {
    const scope = resolveViewScope(actor)
    const attachment = await this.repo.findById(id, scope)
    if (attachment === null) {
      throw new NotFoundError('Attachment', id)
    }

    const claim = await this.claimContext.loadClaimContext(
      attachment.claimKind,
      attachment.claimId,
      actor,
    )
    assertClaimEditable(claim)

    const canDeleteAny = actor.permissions.includes('attachments.delete_any')
    const canDeleteOwn =
      actor.permissions.includes('attachments.delete_own') && attachment.uploadedBy === actor.id

    if (!canDeleteAny && !canDeleteOwn) {
      throw new ForbiddenError()
    }

    await this.repo.softDelete(id)

    await this.audit.log({
      entityType: 'attachment',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: auditContext.actorUserId,
      actorIp: auditContext.actorIp,
      actorUserAgent: auditContext.actorUserAgent,
      context: {
        claimKind: attachment.claimKind,
        claimId: attachment.claimId,
      },
    })

    await this.publishClaimAttachmentsChanged(
      attachment.claimKind,
      attachment.claimId,
      isClientVisibleClaimAttachment(attachment),
    )
  }

  // --- Portal-submission attachments ---

  /**
   * Authorizes access to a submission's attachments. The actor must either hold
   * `client_submissions.manage` (operator/admin) OR own the submission via
   * `client_submissions.create` (`submittedByUserId === actor.id`). Returns **404** (never 403)
   * when the submission is absent OR the actor is a client who does not own it — a client must
   * never learn that another client's submission exists (docs/05: 404 not 403 for row-level access).
   */
  private async authorizeSubmissionAccess(
    submissionId: string,
    actor: AttachmentsActor,
  ): Promise<SubmissionAccessInfo> {
    const submission = await this.submissionAccess.findSubmissionAccess(submissionId)
    if (submission === null) {
      throw new NotFoundError('Client submission', submissionId)
    }

    if (!actor.permissions.includes('client_submissions.manage')) {
      const ownsSubmission =
        actor.permissions.includes('client_submissions.create') &&
        submission.submittedByUserId === actor.id
      if (!ownsSubmission) {
        throw new NotFoundError('Client submission', submissionId)
      }
    }

    return submission
  }

  /**
   * A client uploads files to their OWN pending submission (operator/admin may upload to any).
   * Reuses the same processing pipeline as claim uploads. Rejects once the submission has left the
   * pending state (converted/rejected).
   */
  async uploadToSubmission(
    submissionId: string,
    files: readonly AttachmentUploadFileInput[],
    actor: AttachmentsActor,
    auditContext: AttachmentsAuditContext,
  ): Promise<SubmissionAttachmentUploadResult> {
    const submission = await this.authorizeSubmissionAccess(submissionId, actor)
    if (submission.status !== ClientSubmissionStatus.Pending) {
      throw new ConflictError('Submission is no longer open for attachments')
    }

    const stats = await this.repo.countActiveForSubmission(submissionId)
    if (stats.count + files.length > MAX_FILES_PER_CLAIM) {
      throw new ConflictError(`Submission attachment limit reached (${MAX_FILES_PER_CLAIM})`)
    }

    const items: SubmissionAttachmentItem[] = []
    let skippedDuplicates = 0
    let runningTotalBytes = stats.totalBytes

    for (const file of files) {
      const { storedData, storedMime, contentSha256, optimized } =
        await this.processUploadFile(file)

      if (runningTotalBytes + storedData.byteLength > MAX_TOTAL_SIZE_BYTES) {
        throw new PayloadTooLargeError(
          `Submission attachment total size exceeds ${MAX_TOTAL_SIZE_PER_CLAIM_MB} MB`,
        )
      }

      const existing = await this.repo.findSubmissionAttachmentByContentHash(
        submissionId,
        contentSha256,
      )
      if (existing !== null) {
        items.push(existing)
        skippedDuplicates += 1
        continue
      }

      const attachmentId = randomUUID()
      const extension = extensionForMimeType(storedMime)
      const storagePath = buildSubmissionAttachmentStoragePath({
        submissionId,
        attachmentId,
        extension,
      })

      const { width, height, thumbnailPath } = await this.writeStoredFile({
        storagePath,
        storedData,
        storedMime,
        optimized,
      })

      const created = await this.repo.insertSubmissionAttachment({
        submissionId,
        fileName: alignFileNameExtension(sanitizeUploadFileName(file.fileName), storedMime),
        storagePath,
        mimeType: storedMime,
        fileSizeBytes: storedData.byteLength,
        contentSha256,
        width,
        height,
        thumbnailPath,
        caption: file.caption ?? null,
        uploadedBy: actor.id,
      })

      runningTotalBytes += storedData.byteLength

      await this.audit.log({
        entityType: 'attachment',
        entityId: created.id,
        action: AuditAction.Create,
        actorUserId: auditContext.actorUserId,
        actorIp: auditContext.actorIp,
        actorUserAgent: auditContext.actorUserAgent,
        context: {
          clientSubmissionId: submissionId,
          fileName: created.fileName,
        },
      })

      items.push(created)
    }

    if (items.length > 0) {
      this.events.publishClientSubmissionChanged(submissionId)
    }

    return { items, skippedDuplicates }
  }

  /** Lists a submission's attachments — owner (client) or `.manage`; 404 otherwise. */
  async listForSubmission(
    submissionId: string,
    actor: AttachmentsActor,
  ): Promise<{ items: SubmissionAttachmentItem[] }> {
    await this.authorizeSubmissionAccess(submissionId, actor)
    const items = await this.repo.listBySubmission(submissionId)
    return { items }
  }

  /**
   * Access-checked download metadata for a submission attachment — owner (client) or `.manage`;
   * 404 otherwise, and 404 when the attachment does not belong to the submission.
   */
  async getSubmissionDownloadMeta(
    submissionId: string,
    attachmentId: string,
    actor: AttachmentsActor,
    variant: 'original' | 'thumbnail',
  ): Promise<{ storagePath: string; mimeType: string; fileName: string; etag: string | null }> {
    await this.authorizeSubmissionAccess(submissionId, actor)

    const row = await this.repo.findSubmissionAttachmentRaw(attachmentId, submissionId)
    if (row === null) {
      throw new NotFoundError('Attachment', attachmentId)
    }

    const thumbnailPath = variant === 'thumbnail' ? row.thumbnailPath : null
    return {
      storagePath: thumbnailPath ?? row.storagePath,
      // Thumbnails are always generated as JPEG (see generateImageThumbnail).
      mimeType: thumbnailPath !== null ? 'image/jpeg' : row.mimeType,
      fileName: row.fileName,
      etag:
        row.contentSha256 === null
          ? null
          : `"${row.contentSha256}${thumbnailPath !== null ? '-thumb' : ''}"`,
    }
  }
}
