import { queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { DomaceClaimDetail } from '../schemas/domace-claim.schema.js'
import { domaceClaimKeys } from './domace-claim-keys.js'

const DOMACE_CLAIM_DETAIL_STALE_MS = 60_000

export function domaceClaimDetailOptions(id: string) {
  return queryOptions({
    queryKey: domaceClaimKeys.detail(id),
    queryFn: () => fetchJson<DomaceClaimDetail>(`/api/domace-claims/${id}`),
    staleTime: DOMACE_CLAIM_DETAIL_STALE_MS,
  })
}
