import type { ClaimEventPayload } from '@mr/shared'

import type { EventBus } from '../modules/events/event-bus.js'

export type RecordedClaimEvent =
  | { type: 'created'; payload: ClaimEventPayload }
  | { type: 'updated'; payload: ClaimEventPayload }
  | { type: 'deleted'; payload: ClaimEventPayload }

export class RecordingEventBus implements EventBus {
  readonly events: RecordedClaimEvent[] = []

  publishClaimCreated(payload: ClaimEventPayload): void {
    this.events.push({ type: 'created', payload })
  }

  publishClaimUpdated(payload: ClaimEventPayload): void {
    this.events.push({ type: 'updated', payload })
  }

  publishClaimDeleted(payload: ClaimEventPayload): void {
    this.events.push({ type: 'deleted', payload })
  }
}
