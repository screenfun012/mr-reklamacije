import { queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { ClaimKind } from '../enums.js'
import type { ClaimReportResponse, ClaimReportUpsertBody } from '../schemas/claim-report.schema.js'
import { claimReportKeys } from './claim-report-keys.js'

const CLAIM_REPORT_STALE_MS = 30_000

export function claimReportOptions(claimKind: ClaimKind, claimId: string) {
  const params = new URLSearchParams({ claimKind, claimId })

  return queryOptions({
    queryKey: claimReportKeys.detail(claimKind, claimId),
    queryFn: () => fetchJson<ClaimReportResponse>(`/api/claim-reports?${params.toString()}`),
    staleTime: CLAIM_REPORT_STALE_MS,
  })
}

export async function upsertClaimReport(
  claimKind: ClaimKind,
  claimId: string,
  body: ClaimReportUpsertBody,
): Promise<ClaimReportResponse> {
  const params = new URLSearchParams({ claimKind, claimId })

  return fetchJson<ClaimReportResponse>(`/api/claim-reports?${params.toString()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
