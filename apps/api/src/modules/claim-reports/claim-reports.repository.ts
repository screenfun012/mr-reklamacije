import { ClaimKind, type ClaimReportQuery, type ClaimReportResponse } from '@mr/shared'
import { and, eq, sql } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { claimReports } from './claim-reports.schema.js'
import type { ClaimReportRow, ClaimReportUpsertInput } from './claim-reports.types.js'

function mapClaimIdColumn(claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace) {
  return claimKind === ClaimKind.Emotive ? claimReports.emotiveClaimId : claimReports.domaceClaimId
}

function mapRow(row: typeof claimReports.$inferSelect, claimId: string): ClaimReportRow {
  return {
    id: row.id,
    claimKind: row.claimKind,
    claimId,
    contentJson: row.contentJson as ClaimReportResponse['contentJson'],
    contentHtml: row.contentHtml,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  }
}

export class ClaimReportsRepository {
  constructor(private readonly db: ApiDatabase) {}

  async findByClaim(query: ClaimReportQuery): Promise<ClaimReportRow | null> {
    const claimColumn = mapClaimIdColumn(query.claimKind)
    const rows = await this.db
      .select()
      .from(claimReports)
      .where(and(eq(claimReports.claimKind, query.claimKind), eq(claimColumn, query.claimId)))
      .limit(1)

    const row = rows[0]
    if (row === undefined) {
      return null
    }

    return mapRow(row, query.claimId)
  }

  async upsert(input: ClaimReportUpsertInput): Promise<ClaimReportRow> {
    const now = new Date()
    const isEmotive = input.claimKind === ClaimKind.Emotive
    const targetColumn = isEmotive ? claimReports.emotiveClaimId : claimReports.domaceClaimId

    // Single race-safe statement: INSERT, and on the per-kind partial unique index
    // (one report per claim) fall through to UPDATE. Replaces the old SELECT-then-INSERT
    // whose 23505 on a concurrent first save escaped as a 500. createdBy/createdAt stay
    // OUT of `set` so the original creator + creation time survive an update.
    const upserted = await this.db
      .insert(claimReports)
      .values({
        claimKind: input.claimKind,
        emotiveClaimId: isEmotive ? input.claimId : null,
        domaceClaimId: isEmotive ? null : input.claimId,
        contentJson: input.contentJson,
        contentHtml: input.contentHtml,
        createdBy: input.updatedBy,
        updatedBy: input.updatedBy,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: targetColumn,
        targetWhere: sql`${targetColumn} IS NOT NULL`,
        set: {
          contentJson: input.contentJson,
          contentHtml: input.contentHtml,
          updatedBy: input.updatedBy,
          updatedAt: now,
        },
      })
      .returning()

    const row = upserted[0]
    if (row === undefined) {
      throw new Error('Failed to upsert claim report')
    }

    return mapRow(row, input.claimId)
  }
}
