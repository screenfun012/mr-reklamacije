import {
  AuditAction,
  ClientSubmissionStatus,
  MAX_FILES_PER_CLAIM,
  MAX_TOTAL_SIZE_PER_CLAIM_MB,
  extensionForMimeType,
} from '@mr/shared'
import { randomUUID } from 'node:crypto'

import {
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
} from '../../core/errors/domain-errors.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type {
  SubmissionAccessInfo,
  SubmissionAccessPort,
} from '../../core/ports/submission-access-port.js'
import {
  buildSubmissionAttachmentStoragePath,
  sanitizeUploadFileName,
  type StorageService,
} from '../../infrastructure/storage/storage.interface.js'
import {
  resolveAttachmentDownloadMeta,
  type AttachmentDownloadMeta,
} from '../../core/attachments/attachment-download-meta.js'
import {
  alignFileNameExtension,
  processUploadFile,
  writeStoredFile,
  MAX_TOTAL_SIZE_BYTES,
  type AttachmentUploadFileInput,
} from '../../core/attachments/attachment-upload-pipeline.js'
import { AttachmentsRepository } from './attachments.repository.js'
import type {
  AttachmentsActor,
  AttachmentsAuditContext,
  SubmissionAttachmentItem,
  SubmissionAttachmentUploadResult,
} from './attachments.types.js'

/**
 * Portal-submission attachments — a client uploads/lists/downloads files on their OWN pending
 * submission (operator/admin `.manage` may touch any). Split out of `AttachmentsService` (which
 * owns claim + report-image attachments); reuses the shared upload pipeline and download-meta
 * resolver so the two surfaces stay byte-identical.
 */
export class SubmissionAttachmentsService {
  constructor(
    private readonly repo: AttachmentsRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditPort,
    private readonly events: EventBus,
    private readonly submissionAccess: SubmissionAccessPort,
  ) {}

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
      const { storedData, storedMime, contentSha256, optimized } = await processUploadFile(file)

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

      const { width, height, thumbnailPath } = await writeStoredFile(this.storage, {
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
  ): Promise<AttachmentDownloadMeta> {
    await this.authorizeSubmissionAccess(submissionId, actor)

    const row = await this.repo.findSubmissionAttachmentRaw(attachmentId, submissionId)
    if (row === null) {
      throw new NotFoundError('Attachment', attachmentId)
    }

    return resolveAttachmentDownloadMeta(row, variant)
  }

  /** Streamed file body for a path previously resolved via getSubmissionDownloadMeta. */
  async openDownloadStream(
    storagePath: string,
  ): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
    return this.storage.readStream(storagePath)
  }
}
