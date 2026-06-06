import { ClaimEventType, type ClaimEventPayload } from './claim-events.js'

/** Server → client SSE payload for claim lifecycle (docs/05-auth-realtime.md). */
export type ClaimAppEvent =
  | { type: typeof ClaimEventType.Created; payload: ClaimEventPayload }
  | { type: typeof ClaimEventType.Updated; payload: ClaimEventPayload }
  | { type: typeof ClaimEventType.Deleted; payload: ClaimEventPayload }

/**
 * Union of all SSE events the API may push. Extended in later phases
 * (permissions_changed, session_invalidated, …).
 */
export type AppEvent = ClaimAppEvent
