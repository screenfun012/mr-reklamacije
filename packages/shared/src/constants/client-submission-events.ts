/** Server → client SSE event for the internal client-submissions Inbox (docs/18). */
export const ClientSubmissionEventType = {
  Changed: 'client_submission_changed',
} as const

export type ClientSubmissionEventType =
  (typeof ClientSubmissionEventType)[keyof typeof ClientSubmissionEventType]

/**
 * Signal-only payload: the internal client re-fetches the Inbox list + badge on
 * receipt (server is the single source of truth). Carries just the submission id.
 */
export interface ClientSubmissionEventPayload {
  id: string
}
