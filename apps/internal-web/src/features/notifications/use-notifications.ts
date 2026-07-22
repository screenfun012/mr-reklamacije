import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  notificationsListOptions,
  snoozeNotification,
  type NotificationListResponse,
} from '@mr/shared'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'

const rootRoute = getRouteApi('__root__')

/** The bell reads page 1 only; the panel scrolls within it. */
const FIRST_PAGE = 1

export function useCanSeeNotifications(): boolean {
  const { authSession } = rootRoute.useRouteContext()
  return authSession?.user?.permissions.includes('notifications.view_own') === true
}

export function useNotifications(): {
  data: NotificationListResponse | undefined
  isPending: boolean
  isError: boolean
  refetch: () => void
} {
  const enabled = useCanSeeNotifications()
  const query = useQuery({ ...notificationsListOptions(FIRST_PAGE), enabled })

  return {
    data: query.data,
    isPending: enabled && query.isPending,
    isError: query.isError,
    refetch: () => {
      void query.refetch()
    },
  }
}

/** Optimistically flips one row to read, then rolls back if the server refuses. */
export function useMarkNotificationRead(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  const key = notificationKeys.list(FIRST_PAGE)

  return useMutation<void, Error, string, { previous: NotificationListResponse | undefined }>({
    mutationFn: (id) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<NotificationListResponse>(key)
      if (previous !== undefined) {
        queryClient.setQueryData<NotificationListResponse>(key, {
          ...previous,
          items: previous.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
          unreadCount: Math.max(0, previous.unreadCount - (isUnread(previous, id) ? 1 : 0)),
        })
      }
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(key, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() })
    },
  })
}

export function useMarkAllNotificationsRead(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient()
  const key = notificationKeys.list(FIRST_PAGE)

  return useMutation<void, Error, void, { previous: NotificationListResponse | undefined }>({
    mutationFn: () => markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<NotificationListResponse>(key)
      if (previous !== undefined) {
        queryClient.setQueryData<NotificationListResponse>(key, {
          ...previous,
          items: previous.items.map((item) => ({ ...item, isRead: true })),
          unreadCount: 0,
        })
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(key, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() })
    },
  })
}

/** Postpones the popup. The row stays unread, so the bell is untouched. */
export function useSnoozeNotification(): UseMutationResult<
  void,
  Error,
  { id: string; until: Date }
> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { id: string; until: Date }>({
    mutationFn: ({ id, until }) => snoozeNotification(id, until),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() })
    },
  })
}

function isUnread(list: NotificationListResponse, id: string): boolean {
  return list.items.some((item) => item.id === id && !item.isRead)
}
