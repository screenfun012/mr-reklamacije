import { ClaimEventType, type ClaimEventPayload } from './claim-events.js'
import { ResourceEventType, type ResourceChangedPayload } from './resource-events.js'

/** Server → client SSE payload for claim lifecycle (docs/05-auth-realtime.md). */
export type ClaimAppEvent =
  | { type: typeof ClaimEventType.Created; payload: ClaimEventPayload }
  | { type: typeof ClaimEventType.Updated; payload: ClaimEventPayload }
  | { type: typeof ClaimEventType.Deleted; payload: ClaimEventPayload }

/** Server → client SSE payload when an admin-managed catalog resource changes. */
export type ResourceChangedAppEvent = {
  type: typeof ResourceEventType.Changed
  payload: ResourceChangedPayload
}

/**
 * Union of all SSE events the API may push. Extended in later phases
 * (permissions_changed, session_invalidated, …).
 */
export type AppEvent = ClaimAppEvent | ResourceChangedAppEvent
