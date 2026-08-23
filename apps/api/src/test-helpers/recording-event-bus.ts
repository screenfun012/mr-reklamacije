import {
  ChatEventType,
  type AppEvent,
  type ClaimEventPayload,
  type ResourceChangedKey,
} from '@mr/shared'

import type { EventBus } from '../core/ports/event-bus-port.js'

export type RecordedClaimEvent =
  | { type: 'created'; payload: ClaimEventPayload; customerId: string | null }
  | { type: 'updated'; payload: ClaimEventPayload; customerId: string | null }
  | { type: 'deleted'; payload: ClaimEventPayload; customerId: string | null }

export type RecordedResourceEvent = { type: 'resource_changed'; resource: ResourceChangedKey }

export type RecordedClientSubmissionEvent = { type: 'client_submission_changed'; id: string }

export type RecordedNotificationEvent = { type: 'notification_created'; userId: string; id: string }

export type RecordedChatEvent = {
  type: typeof ChatEventType.MessageCreated
  conversationId: string
  messageId: string
}

export class RecordingEventBus implements EventBus {
  readonly events: RecordedClaimEvent[] = []
  readonly resourceEvents: RecordedResourceEvent[] = []
  readonly clientSubmissionEvents: RecordedClientSubmissionEvent[] = []
  readonly notificationEvents: RecordedNotificationEvent[] = []
  readonly chatEvents: RecordedChatEvent[] = []

  publishClaimCreated(payload: ClaimEventPayload, customerId: string | null = null): void {
    this.events.push({ type: 'created', payload, customerId })
  }

  publishClaimUpdated(payload: ClaimEventPayload, customerId: string | null = null): void {
    this.events.push({ type: 'updated', payload, customerId })
  }

  publishClaimDeleted(payload: ClaimEventPayload, customerId: string | null = null): void {
    this.events.push({ type: 'deleted', payload, customerId })
  }

  publishResourceChanged(resource: ResourceChangedKey): void {
    this.resourceEvents.push({ type: 'resource_changed', resource })
  }

  publishClientSubmissionChanged(submissionId: string): void {
    this.clientSubmissionEvents.push({ type: 'client_submission_changed', id: submissionId })
  }

  publishNotificationCreated(userId: string, notificationId: string): void {
    this.notificationEvents.push({ type: 'notification_created', userId, id: notificationId })
  }

  publishChatMessageCreated(conversationId: string, messageId: string): void {
    this.chatEvents.push({ type: ChatEventType.MessageCreated, conversationId, messageId })
  }

  subscribeUser(
    _userId: string,
    _roleCodes: readonly string[],
    _listener: (event: AppEvent) => void,
    _customerIds?: readonly string[],
  ): () => void {
    void _userId
    void _roleCodes
    void _listener
    void _customerIds
    return () => {}
  }
}
