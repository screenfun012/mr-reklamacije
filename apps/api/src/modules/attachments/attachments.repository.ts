import {
  AttachmentPurpose,
  AttachmentVisibility,
  ClaimKind,
  type AttachmentListItem,
  type AttachmentListQuery,
} from '@mr/shared'
import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { NotFoundError } from '../../core/errors/domain-errors.js'
import { attachments, emotiveClaims } from './attachments.schema.js'
import type { AttachmentsViewScope, SubmissionAttachmentItem } from './attachments.types.js'

function mapClaimIdColumn(claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace) {
  return claimKind === ClaimKind.Emotive ? attachments.emotiveClaimId : attachments.domaceClaimId
}

function formatTimestamp(value: Date): string {
  return value.toISOString()
}

function mapRow(row: typeof attachments.$inferSelect, claimId: string): AttachmentListItem {
  // Claim attachments always carry claim_kind (one-of CHECK); a client-submission
  // attachment (claim_kind NULL) is never listed through this claim-scoped projection.
  if (row.claimKind === null) {
    throw new Error('Attachment row is missing claim_kind — expected a claim attachment')
  }
  return {
    id: row.id,
    claimKind: row.claimKind,
    claimId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
    thumbnailPath: row.thumbnailPath,
    caption: row.caption,
    visibility: row.visibility,
    uploadedBy: row.uploadedBy,
    uploadedAt: formatTimestamp(row.uploadedAt),
    contentSha256: row.contentSha256 ?? '',
  }
}

function mapSubmissionRow(row: typeof attachments.$inferSelect): SubmissionAttachmentItem {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
    thumbnailPath: row.thumbnailPath,
    caption: row.caption,
    uploadedBy: row.uploadedBy,
    uploadedAt: formatTimestamp(row.uploadedAt),
    contentSha256: row.contentSha256 ?? '',
  }
}

function visibilityFilter(scope: AttachmentsViewScope) {
  if (scope.type === 'internal') {
    return undefined
  }

  // Client rule (Nikola, 2026-07-04): workshop PHOTOS are always visible to
  // the client — any image format, as soon as the operator uploads them.
  // Documents (and report images) stay internal unless explicitly marked
  // client_visible.
  return or(
    eq(attachments.visibility, AttachmentVisibility.ClientVisible),
    and(
      eq(attachments.purpose, AttachmentPurpose.ClaimAttachment),
      ilike(attachments.mimeType, 'image/%'),
    ),
  )
}

export class AttachmentsRepository {
  constructor(private readonly db: ApiDatabase) {}

  /** Owning customer of an EMOTIVE claim — routes portal SSE signals. */
  async findEmotiveClaimCustomerId(claimId: string): Promise<string | null> {
    const rows = await this.db
      .select({ customerId: emotiveClaims.customerId })
      .from(emotiveClaims)
      .where(eq(emotiveClaims.id, claimId))
      .limit(1)

    return rows[0]?.customerId ?? null
  }

  /**
   * Phase 3 freshness: stamps now() when a client-visible attachment is added to or
   * removed from an EMOTIVE claim (a photo, or anything explicitly marked
   * client_visible) — called from the attachments service's single publish choke point.
   */
  async bumpEmotiveClientContentUpdatedAt(claimId: string): Promise<void> {
    await this.db
      .update(emotiveClaims)
      .set({ clientContentUpdatedAt: new Date() })
      .where(eq(emotiveClaims.id, claimId))
  }

  async listByClaim(
    query: AttachmentListQuery,
    scope: AttachmentsViewScope,
  ): Promise<AttachmentListItem[]> {
    const claimColumn = mapClaimIdColumn(query.claimKind)
    const visibilityClause = visibilityFilter(scope)

    const rows = await this.db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.claimKind, query.claimKind),
          eq(claimColumn, query.claimId),
          eq(attachments.purpose, AttachmentPurpose.ClaimAttachment),
          isNull(attachments.deletedAt),
          visibilityClause,
        ),
      )
      .orderBy(attachments.uploadedAt)

    return rows.map((row) => mapRow(row, query.claimId))
  }

  async findById(id: string, scope: AttachmentsViewScope): Promise<AttachmentListItem | null> {
    const visibilityClause = visibilityFilter(scope)
    const rows = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), isNull(attachments.deletedAt), visibilityClause))
      .limit(1)

    const row = rows[0]
    if (row === undefined) {
      return null
    }

    const claimId = row.emotiveClaimId ?? row.domaceClaimId
    if (claimId === null) {
      return null
    }

    return mapRow(row, claimId)
  }

  async findByContentHash(
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace,
    claimId: string,
    contentSha256: string,
    purpose: typeof AttachmentPurpose.ClaimAttachment | typeof AttachmentPurpose.ReportImage,
  ): Promise<AttachmentListItem | null> {
    const claimColumn = mapClaimIdColumn(claimKind)
    const rows = await this.db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.claimKind, claimKind),
          eq(claimColumn, claimId),
          eq(attachments.contentSha256, contentSha256),
          eq(attachments.purpose, purpose),
          isNull(attachments.deletedAt),
        ),
      )
      .limit(1)

    const row = rows[0]
    if (row === undefined) {
      return null
    }

    return mapRow(row, claimId)
  }

  async countActiveForClaim(
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace,
    claimId: string,
  ): Promise<{ count: number; totalBytes: number }> {
    const claimColumn = mapClaimIdColumn(claimKind)
    const rows = await this.db
      .select({
        count: sql<number>`count(*)::int`,
        totalBytes: sql<number>`coalesce(sum(${attachments.fileSizeBytes}), 0)::int`,
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.claimKind, claimKind),
          eq(claimColumn, claimId),
          eq(attachments.purpose, AttachmentPurpose.ClaimAttachment),
          isNull(attachments.deletedAt),
        ),
      )

    const row = rows[0]
    return {
      count: row?.count ?? 0,
      totalBytes: row?.totalBytes ?? 0,
    }
  }

  async countActiveReportImagesForClaim(
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace,
    claimId: string,
  ): Promise<number> {
    const claimColumn = mapClaimIdColumn(claimKind)
    const rows = await this.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.claimKind, claimKind),
          eq(claimColumn, claimId),
          eq(attachments.purpose, AttachmentPurpose.ReportImage),
          isNull(attachments.deletedAt),
        ),
      )

    return rows[0]?.count ?? 0
  }

  async insert(input: {
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace
    claimId: string
    fileName: string
    storagePath: string
    mimeType: string
    fileSizeBytes: number
    contentSha256: string
    width: number | null
    height: number | null
    durationSeconds: number | null
    thumbnailPath: string | null
    caption: string | null
    visibility: typeof AttachmentVisibility.Internal | typeof AttachmentVisibility.ClientVisible
    purpose: typeof AttachmentPurpose.ClaimAttachment | typeof AttachmentPurpose.ReportImage
    uploadedBy: string
  }): Promise<AttachmentListItem> {
    const values = {
      claimKind: input.claimKind,
      emotiveClaimId: input.claimKind === ClaimKind.Emotive ? input.claimId : null,
      domaceClaimId: input.claimKind === ClaimKind.Domace ? input.claimId : null,
      fileName: input.fileName,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      contentSha256: input.contentSha256,
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
      thumbnailPath: input.thumbnailPath,
      caption: input.caption,
      visibility: input.visibility,
      purpose: input.purpose,
      uploadedBy: input.uploadedBy,
    }

    const rows = await this.db.insert(attachments).values(values).returning()
    const row = rows[0]
    if (row === undefined) {
      throw new NotFoundError('Attachment', 'insert')
    }

    return mapRow(row, input.claimId)
  }

  async softDelete(id: string): Promise<AttachmentListItem> {
    const rows = await this.db
      .update(attachments)
      .set({ deletedAt: new Date() })
      .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new NotFoundError('Attachment', id)
    }

    const claimId = row.emotiveClaimId ?? row.domaceClaimId
    if (claimId === null) {
      throw new NotFoundError('Attachment', id)
    }

    return mapRow(row, claimId)
  }

  async findRawById(id: string): Promise<typeof attachments.$inferSelect | null> {
    const rows = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
      .limit(1)

    return rows[0] ?? null
  }

  // --- Portal-submission attachments (claim_kind NULL, client_submission_id set) ---

  async listBySubmission(submissionId: string): Promise<SubmissionAttachmentItem[]> {
    const rows = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.clientSubmissionId, submissionId), isNull(attachments.deletedAt)))
      .orderBy(attachments.uploadedAt)

    return rows.map(mapSubmissionRow)
  }

  /** Raw row scoped to its submission — the submission id must match so a caller cannot fetch
   * another submission's attachment through this submission's route. */
  async findSubmissionAttachmentRaw(
    attachmentId: string,
    submissionId: string,
  ): Promise<typeof attachments.$inferSelect | null> {
    const rows = await this.db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.clientSubmissionId, submissionId),
          isNull(attachments.deletedAt),
        ),
      )
      .limit(1)

    return rows[0] ?? null
  }

  async findSubmissionAttachmentByContentHash(
    submissionId: string,
    contentSha256: string,
  ): Promise<SubmissionAttachmentItem | null> {
    const rows = await this.db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.clientSubmissionId, submissionId),
          eq(attachments.contentSha256, contentSha256),
          isNull(attachments.deletedAt),
        ),
      )
      .limit(1)

    const row = rows[0]
    return row === undefined ? null : mapSubmissionRow(row)
  }

  async countActiveForSubmission(
    submissionId: string,
  ): Promise<{ count: number; totalBytes: number }> {
    const rows = await this.db
      .select({
        count: sql<number>`count(*)::int`,
        totalBytes: sql<number>`coalesce(sum(${attachments.fileSizeBytes}), 0)::int`,
      })
      .from(attachments)
      .where(and(eq(attachments.clientSubmissionId, submissionId), isNull(attachments.deletedAt)))

    const row = rows[0]
    return {
      count: row?.count ?? 0,
      totalBytes: row?.totalBytes ?? 0,
    }
  }

  async insertSubmissionAttachment(input: {
    submissionId: string
    fileName: string
    storagePath: string
    mimeType: string
    fileSizeBytes: number
    contentSha256: string
    width: number | null
    height: number | null
    thumbnailPath: string | null
    caption: string | null
    uploadedBy: string
  }): Promise<SubmissionAttachmentItem> {
    const rows = await this.db
      .insert(attachments)
      .values({
        claimKind: null,
        emotiveClaimId: null,
        domaceClaimId: null,
        clientSubmissionId: input.submissionId,
        fileName: input.fileName,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        contentSha256: input.contentSha256,
        width: input.width,
        height: input.height,
        durationSeconds: null,
        thumbnailPath: input.thumbnailPath,
        caption: input.caption,
        visibility: AttachmentVisibility.Internal,
        purpose: AttachmentPurpose.ClaimAttachment,
        uploadedBy: input.uploadedBy,
      })
      .returning()

    const row = rows[0]
    if (row === undefined) {
      throw new NotFoundError('Attachment', 'insert')
    }

    return mapSubmissionRow(row)
  }
}
