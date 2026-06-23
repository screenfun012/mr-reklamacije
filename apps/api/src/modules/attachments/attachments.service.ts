import {
  AttachmentPurpose,
  AttachmentVisibility,
  AuditAction,
  ClaimKind,
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_CLAIM,
  MAX_REPORT_IMAGES_PER_CLAIM,
  MAX_TOTAL_SIZE_PER_CLAIM_MB,
  detectAttachmentMimeType,
  extensionForMimeType,
  isImageAttachmentMimeType,
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
import {
  buildSignedAttachmentUrl,
  verifySignedAttachmentToken,
} from '../../infrastructure/storage/local-volume-storage.js'
import {
  buildAttachmentStoragePath,
  sanitizeUploadFileName,
  type StorageService,
} from '../../infrastructure/storage/storage.interface.js'
import type { DomaceClaimsRepository } from '../domace-claims/domace-claims.repository.js'
import type { EmotiveClaimsRepository } from '../emotive-claims/emotive-claims.repository.js'
import {
  generateImageThumbnail,
  optimizeReportImage,
  readImageDimensions,
  shouldGenerateImageThumbnail,
} from './attachment-image-processing.js'
import { AttachmentsRepository } from './attachments.repository.js'
import type {
  AttachmentsActor,
  AttachmentsAuditContext,
  AttachmentsViewScope,
  ClaimAttachmentContext,
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

function resolveEmotiveScope(actor: AttachmentsActor) {
  if (actor.permissions.includes('emotive_claims.view')) {
    return { type: 'all' as const }
  }
  if (actor.permissions.includes('emotive_claims.view_own_customer')) {
    return { type: 'own_customer' as const, userId: actor.id }
  }
  throw new ForbiddenError()
}

function resolveDomaceScope(actor: AttachmentsActor) {
  if (actor.permissions.includes('domace_claims.view')) {
    return { type: 'all' as const }
  }
  if (actor.permissions.includes('domace_claims.view_own_customer')) {
    return { type: 'own_customer' as const, userId: actor.id }
  }
  throw new ForbiddenError()
}

export class AttachmentsService {
  constructor(
    private readonly repo: AttachmentsRepository,
    private readonly storage: StorageService,
    private readonly emotiveClaimsRepository: EmotiveClaimsRepository,
    private readonly domaceClaimsRepository: DomaceClaimsRepository,
    private readonly audit: AuditPort,
    private readonly signingSecret: string,
    private readonly apiBaseUrl: string,
  ) {}

  async list(query: AttachmentListQuery, actor: AttachmentsActor): Promise<AttachmentListResponse> {
    const scope = resolveViewScope(actor)
    await this.loadClaimContext(query.claimKind, query.claimId, actor)
    const items = await this.repo.listByClaim(query, scope)
    return { items }
  }

  async findById(id: string, actor: AttachmentsActor): Promise<AttachmentListItem> {
    const scope = resolveViewScope(actor)
    const attachment = await this.repo.findById(id, scope)
    if (attachment === null) {
      throw new NotFoundError('Attachment', id)
    }

    await this.loadClaimContext(attachment.claimKind, attachment.claimId, actor)
    return attachment
  }

  async getSignedUrl(id: string, actor: AttachmentsActor): Promise<AttachmentSignedUrlResponse> {
    await this.findById(id, actor)
    return buildSignedAttachmentUrl(this.apiBaseUrl, id, this.signingSecret)
  }

  async getDownloadPayload(
    id: string,
    actor: AttachmentsActor,
    disposition: 'inline' | 'attachment',
  ): Promise<{
    data: Buffer
    mimeType: string
    fileName: string
    disposition: 'inline' | 'attachment'
  }> {
    await this.findById(id, actor)
    const row = await this.repo.findRawById(id)
    if (row === null) {
      throw new NotFoundError('Attachment', id)
    }

    const data = await this.storage.read(row.storagePath)
    return {
      data,
      mimeType: row.mimeType,
      fileName: row.fileName,
      disposition,
    }
  }

  async getRawDownloadByToken(
    id: string,
    expiresAtEpochSeconds: number,
    token: string,
  ): Promise<{ data: Buffer; mimeType: string; fileName: string }> {
    if (!verifySignedAttachmentToken(id, expiresAtEpochSeconds, token, this.signingSecret)) {
      throw new ForbiddenError('Invalid or expired signed URL')
    }

    const row = await this.repo.findRawById(id)
    if (row === null) {
      throw new NotFoundError('Attachment', id)
    }

    const data = await this.storage.read(row.storagePath)
    return {
      data,
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

    const claim = await this.loadClaimContext(input.claimKind, input.claimId, actor)
    assertClaimEditable(claim)

    const stats = await this.repo.countActiveForClaim(input.claimKind, input.claimId)
    if (stats.count + input.files.length > MAX_FILES_PER_CLAIM) {
      throw new ConflictError(`Claim attachment limit reached (${MAX_FILES_PER_CLAIM})`)
    }

    const items: AttachmentListItem[] = []
    let skippedDuplicates = 0
    let runningTotalBytes = stats.totalBytes

    for (const file of input.files) {
      if (file.data.byteLength > MAX_FILE_SIZE_BYTES) {
        throw new PayloadTooLargeError(`File exceeds ${MAX_FILE_SIZE_MB} MB limit`)
      }

      if (runningTotalBytes + file.data.byteLength > MAX_TOTAL_SIZE_BYTES) {
        throw new PayloadTooLargeError(
          `Claim attachment total size exceeds ${MAX_TOTAL_SIZE_PER_CLAIM_MB} MB`,
        )
      }

      const detectedMime = detectAttachmentMimeType(new Uint8Array(file.data))
      if (detectedMime === null) {
        throw new UnsupportedMediaTypeError('Unsupported file type')
      }

      const contentSha256 = createHash('sha256').update(file.data).digest('hex')
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
      const extension = extensionForMimeType(detectedMime)
      const storagePath = buildAttachmentStoragePath({
        claimKind: input.claimKind,
        claimYear: claim.claimYear,
        claimId: input.claimId,
        attachmentId,
        extension,
      })

      await this.storage.upload({
        path: storagePath,
        data: file.data,
        mimeType: detectedMime,
      })

      const dimensions = shouldGenerateImageThumbnail(detectedMime)
        ? await readImageDimensions(file.data)
        : null

      const thumbnailPath =
        dimensions !== null && shouldGenerateImageThumbnail(detectedMime)
          ? await generateImageThumbnail(this.storage, storagePath, file.data)
          : null

      const created = await this.repo.insert({
        claimKind: input.claimKind,
        claimId: input.claimId,
        fileName: sanitizeUploadFileName(file.fileName),
        storagePath,
        mimeType: detectedMime,
        fileSizeBytes: file.data.byteLength,
        contentSha256,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        durationSeconds: null,
        thumbnailPath,
        caption: file.caption ?? null,
        visibility: input.visibility,
        purpose: AttachmentPurpose.ClaimAttachment,
        uploadedBy: actor.id,
      })

      runningTotalBytes += file.data.byteLength

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

    const claim = await this.loadClaimContext(input.claimKind, input.claimId, actor)
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

    const claim = await this.loadClaimContext(attachment.claimKind, attachment.claimId, actor)
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
  }

  private async loadClaimContext(
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace,
    claimId: string,
    actor: AttachmentsActor,
  ): Promise<ClaimAttachmentContext> {
    if (claimKind === ClaimKind.Emotive) {
      const scope = resolveEmotiveScope(actor)
      const claim = await this.emotiveClaimsRepository.findById(claimId, scope)
      if (claim === null) {
        throw new NotFoundError('Emotive claim', claimId)
      }

      return { outcome: claim.outcome, claimYear: claim.claimYear }
    }

    const scope = resolveDomaceScope(actor)
    const claim = await this.domaceClaimsRepository.findById(claimId, scope)
    if (claim === null) {
      throw new NotFoundError('Domace claim', claimId)
    }

    return { outcome: claim.outcome, claimYear: claim.claimYear }
  }
}
