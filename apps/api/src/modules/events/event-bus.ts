import type { AppEvent, ClaimEventPayload, ResourceChangedKey } from '@mr/shared'

import type { EventBus } from '../../core/ports/event-bus-port.js'

export type { EventBus } from '../../core/ports/event-bus-port.js'

/** No-op bus for tests that do not care about realtime side effects. */
export class NoOpEventBus implements EventBus {
  publishClaimCreated(_payload: ClaimEventPayload): void {
    void _payload
  }

  publishClaimUpdated(_payload: ClaimEventPayload): void {
    void _payload
  }

  publishClaimDeleted(_payload: ClaimEventPayload): void {
    void _payload
  }

  publishResourceChanged(_resource: ResourceChangedKey): void {
    void _resource
  }

  publishClientSubmissionChanged(_submissionId: string): void {
    void _submissionId
  }

  publishNotificationCreated(_userId: string, _notificationId: string): void {
    void _userId
    void _notificationId
  }

  publishChatMessageCreated(_conversationId: string, _messageId: string): void {
    void _conversationId
    void _messageId
  }

  subscribeUser(
    _userId: string,
    _roleCodes: readonly string[],
    _listener: (event: AppEvent) => void,
  ): () => void {
    void _userId
    void _roleCodes
    void _listener
    return () => {}
  }
}
