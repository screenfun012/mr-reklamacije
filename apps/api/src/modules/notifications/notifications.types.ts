import type { NotificationData, NotificationEntityType, NotificationType } from '@mr/shared'

/** One inbox row to write. The fan-out builds these; the repository inserts them in one statement. */
export interface NotificationInsert {
  readonly userId: string
  readonly type: NotificationType
  readonly entityType: NotificationEntityType
  readonly entityId: string
  readonly data: NotificationData
}

/** Just enough of a created row to emit its SSE signal. */
export interface CreatedNotification {
  readonly id: string
  readonly userId: string
}
