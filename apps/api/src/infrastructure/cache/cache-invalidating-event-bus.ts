import type { AppEvent, ClaimEventPayload, ResourceChangedKey } from '@mr/shared'

import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { SummaryCache } from './summary-cache.js'

/**
 * EventBus decorator that invalidates the statistics/dashboard {@link SummaryCache} whenever a
 * claim is created, updated or deleted — the exact moments those aggregates go stale. Every
 * other signal (SSE subscribe, resource/submission/notification events, dispose) is delegated
 * untouched. Composing the bus (rather than editing each claim service) means ALL claim
 * mutations — present and future, including the client-submission → claim path — invalidate the
 * cache through one place.
 *
 * `invalidate()` is fired BEFORE delegating the publish, so the generation is already bumped by
 * the time the SSE signal reaches a client and triggers its refetch.
 */
export class CacheInvalidatingEventBus implements EventBus {
  constructor(
    private readonly inner: EventBus,
    private readonly summaryCache: SummaryCache,
  ) {}

  publishClaimCreated(payload: ClaimEventPayload, customerId?: string | null): void {
    void this.summaryCache.invalidate()
    this.inner.publishClaimCreated(payload, customerId)
  }

  publishClaimUpdated(payload: ClaimEventPayload, customerId?: string | null): void {
    void this.summaryCache.invalidate()
    this.inner.publishClaimUpdated(payload, customerId)
  }

  publishClaimDeleted(payload: ClaimEventPayload, customerId?: string | null): void {
    void this.summaryCache.invalidate()
    this.inner.publishClaimDeleted(payload, customerId)
  }

  publishResourceChanged(resource: ResourceChangedKey): void {
    this.inner.publishResourceChanged(resource)
  }

  publishClientSubmissionChanged(submissionId: string): void {
    this.inner.publishClientSubmissionChanged(submissionId)
  }

  publishNotificationCreated(userId: string, notificationId: string): void {
    this.inner.publishNotificationCreated(userId, notificationId)
  }

  publishChatMessageCreated(conversationId: string, messageId: string): void {
    this.inner.publishChatMessageCreated(conversationId, messageId)
  }

  subscribeUser(
    userId: string,
    roleCodes: readonly string[],
    listener: (event: AppEvent) => void,
    customerIds?: readonly string[],
  ): () => void {
    return this.inner.subscribeUser(userId, roleCodes, listener, customerIds)
  }

  dispose(): Promise<void> {
    return this.inner.dispose?.() ?? Promise.resolve()
  }
}
