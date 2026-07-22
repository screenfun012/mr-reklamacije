import { ClaimEventType, type ClaimEventPayload } from './claim-events.js'
import {
  ClientSubmissionEventType,
  type ClientSubmissionEventPayload,
} from './client-submission-events.js'
import { NotificationEventType, type NotificationEventPayload } from './notification-events.js'
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

/** Server → client SSE payload when a client-submission is created/converted/rejected (docs/18). */
export type ClientSubmissionAppEvent = {
  type: typeof ClientSubmissionEventType.Changed
  payload: ClientSubmissionEventPayload
}

/** Server → client SSE payload when a notification lands in someone's inbox. */
export type NotificationAppEvent = {
  type: typeof NotificationEventType.Created
  payload: NotificationEventPayload
}

/**
 * Union of all SSE events the API may push. Extended in later phases
 * (permissions_changed, session_invalidated, …).
 */
export type AppEvent =
  | ClaimAppEvent
  | ResourceChangedAppEvent
  | ClientSubmissionAppEvent
  | NotificationAppEvent
