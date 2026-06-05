import type { ClaimEventPayload } from '@mr/shared'

/**
 * In-process claim notifications (docs/05-auth-realtime.md).
 * Implemented by NoOpEventBus until SSE hub lands in a later phase.
 */
export interface EventBus {
  publishClaimCreated(payload: ClaimEventPayload): void
  publishClaimUpdated(payload: ClaimEventPayload): void
  publishClaimDeleted(payload: ClaimEventPayload): void
}
