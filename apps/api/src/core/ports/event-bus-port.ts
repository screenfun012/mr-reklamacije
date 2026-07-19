import type { AppEvent, ClaimEventPayload, ResourceChangedKey } from '@mr/shared'

/**
 * In-process claim notifications + SSE subscriptions (docs/05-auth-realtime.md).
 * Production uses PostgresEventBus, transporting over Postgres LISTEN/NOTIFY so
 * events propagate across replicas; tests inject InProcessEventBus/NoOpEventBus/
 * RecordingEventBus directly (no Postgres transport).
 *
 * Claim events fan out to internal role channels AND — when `customerId` is
 * provided — to that customer's channel, so portal clients get the same
 * invalidate-only signal for their own claims (never anyone else's).
 *
 * `dispose?()` is optional: it ends the LISTEN connection on shutdown for
 * transports that hold one (PostgresEventBus); in-memory implementations have
 * nothing to release and deliberately don't implement it.
 */
export interface EventBus {
  publishClaimCreated(payload: ClaimEventPayload, customerId?: string | null): void
  publishClaimUpdated(payload: ClaimEventPayload, customerId?: string | null): void
  publishClaimDeleted(payload: ClaimEventPayload, customerId?: string | null): void

  publishResourceChanged(resource: ResourceChangedKey): void

  /**
   * Signal-only notification that a client-submission changed (created/converted/rejected);
   * fans out to internal role channels so the Inbox list + badge invalidate (docs/18).
   */
  publishClientSubmissionChanged(submissionId: string): void

  /**
   * Registers an SSE listener for direct user events, role-scoped broadcasts
   * and — for portal clients — the channels of their linked customers.
   * Returns unsubscribe; must be called on disconnect to avoid leaks.
   */
  subscribeUser(
    userId: string,
    roleCodes: readonly string[],
    listener: (event: AppEvent) => void,
    customerIds?: readonly string[],
  ): () => void

  /** Ends the transport's LISTEN connection on shutdown. Optional — see above. */
  dispose?(): Promise<void>
}
