import type { ClaimReportResponse } from '@mr/shared'

export interface ClaimReportsActor {
  readonly id: string
  readonly permissions: readonly string[]
}

export interface ClaimReportsAuditContext {
  readonly actorUserId: string
  readonly actorIp: string | null
  readonly actorUserAgent: string | null
}

export interface ClaimReportRow {
  readonly id: string
  readonly claimKind: ClaimReportResponse['claimKind']
  readonly claimId: string
  readonly contentJson: ClaimReportResponse['contentJson']
  readonly contentHtml: string
  readonly status: ClaimReportResponse['status']
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly createdBy: string | null
  readonly updatedBy: string | null
}

export interface ClaimReportUpsertInput {
  readonly claimKind: ClaimReportResponse['claimKind']
  readonly claimId: string
  readonly contentJson: ClaimReportResponse['contentJson']
  readonly contentHtml: string
  readonly updatedBy: string
}
