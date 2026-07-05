import type { QueryClient } from '@tanstack/react-query'

import type { ClaimEventPayload } from '../constants/claim-events.js'
import { attachmentKeys } from './attachment-keys.js'
import { clientClaimKeys } from './claims.js'

/**
 * Invalidate the portal views a claim event affects — the client list (every
 * page), the dashboard summary, the claim's detail and its photos. Driven by an
 * SSE claim event routed through the client's own customer channel, so an
 * operator's outcome change or a new workshop photo appears without a reload.
 * Signal-only: never writes claim data into the cache (the server stays the
 * single source of truth). Uses the shared key factories so it can never drift
 * from where those keys are defined.
 */
export function invalidateClientClaimQueries(
  queryClient: QueryClient,
  payload: ClaimEventPayload,
): void {
  void queryClient.invalidateQueries({ queryKey: clientClaimKeys.lists() })
  void queryClient.invalidateQueries({ queryKey: clientClaimKeys.summary() })
  void queryClient.invalidateQueries({ queryKey: clientClaimKeys.detail(payload.id) })
  void queryClient.invalidateQueries({ queryKey: attachmentKeys.list(payload.kind, payload.id) })
}
