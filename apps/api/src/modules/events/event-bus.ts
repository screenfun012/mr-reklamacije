import type { AppEvent, ClaimEventPayload } from '@mr/shared'

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
