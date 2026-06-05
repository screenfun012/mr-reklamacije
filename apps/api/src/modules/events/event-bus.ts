import type { ClaimEventPayload } from '@mr/shared'

/**
 * In-process claim notifications (docs/05-auth-realtime.md).
 * Stub in Phase 1.1b; InProcessEventBus + GET /api/events/me come later.
 */
export interface EventBus {
  publishClaimCreated(payload: ClaimEventPayload): void
  publishClaimUpdated(payload: ClaimEventPayload): void
  publishClaimDeleted(payload: ClaimEventPayload): void
}

export class NoOpEventBus implements EventBus {
  publishClaimCreated(_payload: ClaimEventPayload): void {
    void _payload
    // wired in Phase 1.1c+ when SSE hub exists
  }

  publishClaimUpdated(_payload: ClaimEventPayload): void {
    void _payload
    // wired in Phase 1.1c+ when SSE hub exists
  }

  publishClaimDeleted(_payload: ClaimEventPayload): void {
    void _payload
    // wired in Phase 1.1c+ when SSE hub exists
  }
}
