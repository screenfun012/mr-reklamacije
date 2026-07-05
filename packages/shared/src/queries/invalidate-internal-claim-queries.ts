import type { QueryClient } from '@tanstack/react-query'

import { ClaimKind } from '../enums.js'
import type { ClaimEventPayload } from '../constants/claim-events.js'
import { claimKeys } from './claim-keys.js'
import { domaceClaimKeys } from './domace-claim-keys.js'
import { emotiveClaimKeys } from './emotive-claim-keys.js'
import { invalidateStatisticsSummary } from './invalidate-statistics-summary.js'

/**
 * Invalidate the internal claim views a claim mutation affects — the SAME set a
 * mutation hook invalidates for the acting user (unified + kind list, the
 * claim's detail, statistics). Driven by an SSE claim event so every OTHER
 * connected internal user reaches the same fresh state without a manual reload.
 * Signal-only: it never writes claim data into the cache (the server stays the
 * single source of truth). Uses the shared key factories so it can never drift
 * from where the keys are defined.
 */
export function invalidateInternalClaimQueries(
  queryClient: QueryClient,
  payload: ClaimEventPayload,
): void {
  void queryClient.invalidateQueries({ queryKey: claimKeys.lists() })
  if (payload.kind === ClaimKind.Emotive) {
    void queryClient.invalidateQueries({ queryKey: emotiveClaimKeys.lists() })
    void queryClient.invalidateQueries({ queryKey: emotiveClaimKeys.detail(payload.id) })
  } else {
    void queryClient.invalidateQueries({ queryKey: domaceClaimKeys.lists() })
    void queryClient.invalidateQueries({ queryKey: domaceClaimKeys.detail(payload.id) })
  }
  void invalidateStatisticsSummary(queryClient)
}
