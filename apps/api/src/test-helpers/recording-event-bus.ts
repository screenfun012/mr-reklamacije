import type { AppEvent, ClaimEventPayload, ResourceChangedKey } from '@mr/shared'

import type { EventBus } from '../core/ports/event-bus-port.js'

export type RecordedClaimEvent =
  | { type: 'created'; payload: ClaimEventPayload; customerId: string | null }
  | { type: 'updated'; payload: ClaimEventPayload; customerId: string | null }
  | { type: 'deleted'; payload: ClaimEventPayload; customerId: string | null }

export type RecordedResourceEvent = { type: 'resource_changed'; resource: ResourceChangedKey }

export class RecordingEventBus implements EventBus {
  readonly events: RecordedClaimEvent[] = []
  readonly resourceEvents: RecordedResourceEvent[] = []

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
