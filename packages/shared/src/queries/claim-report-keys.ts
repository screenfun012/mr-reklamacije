import type { ClaimKind } from '../enums.js'

export const claimReportKeys = {
  all: ['claim-reports'] as const,
  details: () => [...claimReportKeys.all, 'detail'] as const,
  detail: (claimKind: ClaimKind, claimId: string) =>
    [...claimReportKeys.details(), claimKind, claimId] as const,
}
