import type { ClaimEventPayload } from '@mr/shared'

import type { EventBus } from '../../core/ports/event-bus-port.js'

export type { EventBus } from '../../core/ports/event-bus-port.js'

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
}
