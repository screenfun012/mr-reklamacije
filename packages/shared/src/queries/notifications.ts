import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { fetchNoContent } from '../api/fetch-no-content.js'
import { fetchParsed } from '../api/fetch-json.js'
import { NOTIFICATIONS_PAGE_SIZE } from '../constants/notifications.js'
import { NotificationListResponseSchema } from '../schemas/notification.schema.js'

const NOTIFICATIONS_STALE_MS = 15_000

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (page: number) => [...notificationKeys.lists(), { page }] as const,
}

/** The bell's inbox: one page, newest first. `unreadCount` drives the badge. */
export function notificationsListOptions(page: number) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(NOTIFICATIONS_PAGE_SIZE),
  })

  return queryOptions({
    queryKey: notificationKeys.list(page),
    queryFn: () =>
      fetchParsed(`/api/notifications?${query.toString()}`, NotificationListResponseSchema),
    staleTime: NOTIFICATIONS_STALE_MS,
    placeholderData: keepPreviousData,
  })
}

export function markNotificationRead(id: string): Promise<void> {
  return fetchNoContent(`/api/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead(): Promise<void> {
  return fetchNoContent('/api/notifications/mark-all-read', { method: 'POST' })
}

/** Removes one of the caller's own rows — clears it from their bell only. */
export function deleteNotification(id: string): Promise<void> {
  return fetchNoContent(`/api/notifications/${id}`, { method: 'DELETE' })
}

/** Clears the caller's whole inbox. */
export function deleteAllNotifications(): Promise<void> {
  return fetchNoContent('/api/notifications', { method: 'DELETE' })
}

/** Postpones this notification's popup until `until`; it stays unread meanwhile. */
export function snoozeNotification(id: string, until: Date): Promise<void> {
  return fetchNoContent(`/api/notifications/${id}/snooze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ until: until.toISOString() }),
  })
}
