import type { AppEvent, ClaimEventPayload } from '@mr/shared'

/**
 * In-process claim notifications + SSE subscriptions (docs/05-auth-realtime.md).
 * Production uses InProcessEventBus; tests may inject RecordingEventBus.
 *
 * Multi-instance deployments need a distributed pub/sub layer (e.g. Redis) — out of
 * scope for Phase 1.1d (single API process).
 */
export interface EventBus {
  publishClaimCreated(payload: ClaimEventPayload): void
  publishClaimUpdated(payload: ClaimEventPayload): void
  publishClaimDeleted(payload: ClaimEventPayload): void

  /**
   * Registers an SSE listener for direct user events and role-scoped broadcasts.
   * Returns unsubscribe; must be called on disconnect to avoid leaks.
   */
  subscribeUser(
    userId: string,
    roleCodes: readonly string[],
    listener: (event: AppEvent) => void,
  ): () => void
}
