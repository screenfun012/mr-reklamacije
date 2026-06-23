import { ClaimKind, type ClaimReportQuery, type ClaimReportResponse } from '@mr/shared'
import { and, eq } from 'drizzle-orm'

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
    const existing = await this.findByClaim({
      claimKind: input.claimKind,
      claimId: input.claimId,
    })

    if (existing === null) {
      const values =
        input.claimKind === ClaimKind.Emotive
          ? {
              claimKind: input.claimKind,
              emotiveClaimId: input.claimId,
              domaceClaimId: null,
              contentJson: input.contentJson,
              contentHtml: input.contentHtml,
              createdBy: input.updatedBy,
              updatedBy: input.updatedBy,
              createdAt: now,
              updatedAt: now,
            }
          : {
              claimKind: input.claimKind,
              emotiveClaimId: null,
              domaceClaimId: input.claimId,
              contentJson: input.contentJson,
              contentHtml: input.contentHtml,
              createdBy: input.updatedBy,
              updatedBy: input.updatedBy,
              createdAt: now,
              updatedAt: now,
            }

      const inserted = await this.db.insert(claimReports).values(values).returning()
      const row = inserted[0]
      if (row === undefined) {
        throw new Error('Failed to insert claim report')
      }

      return mapRow(row, input.claimId)
    }

    const claimColumn = mapClaimIdColumn(input.claimKind)
    const updated = await this.db
      .update(claimReports)
      .set({
        contentJson: input.contentJson,
        contentHtml: input.contentHtml,
        updatedBy: input.updatedBy,
        updatedAt: now,
      })
      .where(and(eq(claimReports.claimKind, input.claimKind), eq(claimColumn, input.claimId)))
      .returning()

    const row = updated[0]
    if (row === undefined) {
      throw new Error('Failed to update claim report')
    }

    return mapRow(row, input.claimId)
  }
}
