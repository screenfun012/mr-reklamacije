import {
  AttachmentVisibility,
  ClaimKind,
  type AttachmentListItem,
  type AttachmentListQuery,
} from '@mr/shared'
import { and, eq, isNull, sql } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { NotFoundError } from '../../core/errors/domain-errors.js'
import { attachments } from './attachments.schema.js'
import type { AttachmentsViewScope } from './attachments.types.js'

function mapClaimIdColumn(claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace) {
  return claimKind === ClaimKind.Emotive ? attachments.emotiveClaimId : attachments.domaceClaimId
}

function formatTimestamp(value: Date): string {
  return value.toISOString()
}

function mapRow(row: typeof attachments.$inferSelect, claimId: string): AttachmentListItem {
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

function visibilityFilter(scope: AttachmentsViewScope) {
  if (scope.type === 'internal') {
    return undefined
  }

  return eq(attachments.visibility, AttachmentVisibility.ClientVisible)
}

export class AttachmentsRepository {
  constructor(private readonly db: ApiDatabase) {}

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
          isNull(attachments.deletedAt),
        ),
      )

    const row = rows[0]
    return {
      count: row?.count ?? 0,
      totalBytes: row?.totalBytes ?? 0,
    }
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
}
