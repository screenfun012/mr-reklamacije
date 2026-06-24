import type { ClaimKind } from '@mr/shared'

export interface ReportImageReadInput {
  readonly claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace
  readonly claimId: string
  readonly attachmentId: string
}

export interface ReportImageReadResult {
  readonly data: Buffer
  readonly mimeType: string
}

export interface ReportImageReadPort {
  loadReportImage(input: ReportImageReadInput): Promise<ReportImageReadResult | null>
}
