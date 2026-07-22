export const NotificationEventType = {
  Created: 'notification_created',
} as const

export type NotificationEventType =
  (typeof NotificationEventType)[keyof typeof NotificationEventType]

/**
 * Signal only: the id is enough for the client to invalidate its inbox query and
 * diff for a popup. The notification's text never travels over SSE.
 */
export interface NotificationEventPayload {
  id: string
}
