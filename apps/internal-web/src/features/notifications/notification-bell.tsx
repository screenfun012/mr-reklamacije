import { getLocale, m } from '@mr/i18n'
import { formatTimeAgo, type NotificationItem } from '@mr/shared'
import { cn, Popover, PopoverContent, PopoverTrigger } from '@mr/ui'
import { useNavigate } from '@tanstack/react-router'
import { Bell, Trash2 } from 'lucide-react'

import {
  notificationEyebrow,
  notificationIcon,
  notificationTarget,
  notificationTitle,
} from './notification-presentation'
import { useNotificationsUi } from './notifications-context'
import {
  useCanSeeNotifications,
  useDeleteAllNotifications,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from './use-notifications'

const PANEL_CLASSES =
  'mri-glass mri-glass-in w-[380px] max-h-[70vh] overflow-y-auto rounded-[18px] border-0 bg-transparent p-0 text-[var(--mrg-text)] shadow-none'

/** Bell + unread badge in the topbar; opens the notification inbox panel. */
export function NotificationBell(): React.ReactElement | null {
  const canSee = useCanSeeNotifications()
  const { isPanelOpen, setPanelOpen } = useNotificationsUi()
  const { data, isPending, isError, refetch } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const deleteOne = useDeleteNotification()
  const deleteAll = useDeleteAllNotifications()
  const navigate = useNavigate()

  if (!canSee) {
    return null
  }

  const unreadCount = data?.unreadCount ?? 0
  const items = data?.items ?? []

  function openNotification(item: NotificationItem): void {
    if (!item.isRead) {
      markRead.mutate(item.id)
    }
    setPanelOpen(false)
    const target = notificationTarget(item)
    if (target !== null) {
      navigate(target)
    }
  }

  return (
    <Popover open={isPanelOpen} onOpenChange={setPanelOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? m.notifications_unread_aria({ count: unreadCount })
              : m.notifications_open_aria()
          }
          className="relative grid size-9 flex-none place-items-center rounded-[9px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-text"
        >
          <Bell className="size-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-mri-red px-1 font-mono text-[9.5px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={10} className={PANEL_CLASSES}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--mrg-sep)] px-4 py-3.5">
          <span className="text-[14.5px] font-bold">{m.notifications_title()}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              className="text-[12.5px] text-[var(--mrg-text2)] transition-colors hover:text-[var(--mrg-text)] disabled:pointer-events-none disabled:opacity-45"
            >
              {m.notifications_mark_all_read()}
            </button>
            <button
              type="button"
              disabled={items.length === 0 || deleteAll.isPending}
              onClick={() => deleteAll.mutate()}
              className="text-[12.5px] text-[var(--mrg-text2)] transition-colors hover:text-mri-redh disabled:pointer-events-none disabled:opacity-45"
            >
              {m.notifications_delete_all()}
            </button>
          </div>
        </div>

        {isPending ? <NotificationSkeleton /> : null}
        {isError ? <NotificationError onRetry={refetch} /> : null}
        {!isPending && !isError && items.length === 0 ? <NotificationEmpty /> : null}

        {items.map((item) => (
          <NotificationRow
            key={item.id}
            item={item}
            onOpen={() => openNotification(item)}
            onDelete={() => deleteOne.mutate(item.id)}
          />
        ))}
      </PopoverContent>
    </Popover>
  )
}

function NotificationRow({
  item,
  onOpen,
  onDelete,
}: {
  item: NotificationItem
  onOpen: () => void
  onDelete: () => void
}): React.ReactElement {
  const Icon = notificationIcon(item.type)

  return (
    <div className="group relative flex items-start transition-colors hover:bg-[var(--mrg-hover)]">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 py-[13px] pl-4 pr-2 text-left"
      >
        {item.isRead ? (
          // Spacer, not a dot — read and unread rows must keep the same columns.
          <span aria-hidden="true" className="mt-1.5 size-[7px] flex-none" />
        ) : (
          <span
            aria-hidden="true"
            className="mt-1.5 size-[7px] flex-none rounded-full bg-mri-redh shadow-[0_0_8px_rgba(237,28,36,0.8)]"
          />
        )}
        <Icon
          className={cn('mt-0.5 size-[17px] flex-none', item.isRead && 'opacity-75')}
          style={{ color: 'var(--mrg-icon)' }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block text-[13.5px] leading-snug',
              item.isRead
                ? 'font-medium text-[var(--mrg-text2)]'
                : 'font-semibold text-[var(--mrg-text)]',
            )}
          >
            {notificationTitle(item)}
          </span>
          <span
            className={cn(
              'mt-1 block font-mono text-[11px] text-[var(--mrg-text2)]',
              item.isRead && 'opacity-75',
            )}
          >
            {notificationEyebrow(item)} · {formatTimeAgo(item.createdAt, getLocale(), new Date())}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={m.notifications_delete()}
        className="mr-2 mt-[11px] grid size-7 flex-none place-items-center rounded-[7px] text-[var(--mrg-text2)] opacity-0 transition-all hover:bg-mri-redh/12 hover:text-mri-redh focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-[15px]" aria-hidden="true" />
      </button>
    </div>
  )
}

function NotificationSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 p-4" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-start gap-3">
          <span
            className="mri-glass-skeleton size-[17px] flex-none rounded"
            style={{ animationDelay: `${row * 0.1}s` }}
          />
          <span className="flex flex-1 flex-col gap-2">
            <span
              className="mri-glass-skeleton h-3 w-[78%] rounded"
              style={{ animationDelay: `${row * 0.1}s` }}
            />
            <span
              className="mri-glass-skeleton h-2.5 w-[32%] rounded"
              style={{ animationDelay: `${row * 0.1}s` }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}

function NotificationEmpty(): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-9">
      <Bell
        className="size-[26px] opacity-50"
        style={{ color: 'var(--mrg-text2)' }}
        aria-hidden="true"
      />
      <p className="text-[13.5px] italic text-[var(--mrg-text2)]">{m.notifications_empty()}</p>
    </div>
  )
}

function NotificationError({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-start gap-1.5 px-4 py-6">
      <p className="text-[13px] text-[var(--mrg-text2)]">{m.notifications_error()}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-[13px] font-semibold text-mri-redh hover:underline"
      >
        {m.notifications_retry()}
      </button>
    </div>
  )
}
