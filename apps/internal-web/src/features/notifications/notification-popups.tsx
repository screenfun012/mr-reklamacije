import { getLocale, m } from '@mr/i18n'
import {
  ClaimOutcome,
  formatTimeAgo,
  NOTIFICATION_POPUP_DURATION_MS,
  NOTIFICATION_POPUP_MAX_VISIBLE,
  NotificationSnoozePreset,
  NotificationType,
  type NotificationItem,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  notificationIcon,
  notificationTarget,
  notificationTitle,
} from './notification-presentation'
import { resolveSnoozeUntil } from './snooze-presets'
import { useNotificationsUi } from './notifications-context'
import {
  useMarkNotificationRead,
  useNotifications,
  useSnoozeNotification,
} from './use-notifications'

/** How often we re-check whether a snoozed notification has come due. */
const SNOOZE_TICK_MS = 30_000
const TIMER_TICK_MS = 100

interface Popup {
  item: NotificationItem
  /** True when this popup is a snooze coming due rather than a fresh arrival. */
  isReminder: boolean
}

/**
 * macOS-style popup stack in the top-right corner. Shows notifications that
 * arrive WHILE the app is open — never the backlog on load, which would greet a
 * user with a wall of cards every morning; the bell carries those.
 */
export function NotificationPopups(): React.ReactElement | null {
  const { data } = useNotifications()
  const { isPanelOpen } = useNotificationsUi()
  const [popups, setPopups] = useState<Popup[]>([])
  const surfacedRef = useRef<Set<string>>(new Set())
  const remindedRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const [now, setNow] = useState(() => Date.now())

  const items = data?.items

  // A steady tick so a snooze that expires while the app sits open still fires.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), SNOOZE_TICK_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (items === undefined) {
      return
    }

    // First load only records what already exists — nothing pops.
    if (!initializedRef.current) {
      for (const item of items) {
        surfacedRef.current.add(item.id)
      }
      initializedRef.current = true
      return
    }

    const fresh: Popup[] = []
    for (const item of items) {
      if (item.isRead) {
        continue
      }
      const snoozedUntil = item.snoozedUntil === null ? null : new Date(item.snoozedUntil).getTime()
      const isSnoozed = snoozedUntil !== null && snoozedUntil > now

      if (!surfacedRef.current.has(item.id)) {
        surfacedRef.current.add(item.id)
        if (!isSnoozed) {
          fresh.push({ item, isReminder: false })
        }
        continue
      }

      const isDueReminder = snoozedUntil !== null && !isSnoozed && !remindedRef.current.has(item.id)
      if (isDueReminder) {
        remindedRef.current.add(item.id)
        fresh.push({ item, isReminder: true })
      }
    }

    if (fresh.length > 0) {
      setPopups((prev) => [...fresh, ...prev].slice(0, NOTIFICATION_POPUP_MAX_VISIBLE))
    }
  }, [items, now])

  const dismiss = useCallback((id: string) => {
    setPopups((prev) => prev.filter((popup) => popup.item.id !== id))
  }, [])

  // The panel already shows everything — popups would just be noise on top of it.
  if (isPanelOpen || popups.length === 0) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-[18px] top-[72px] z-40 flex w-[360px] flex-col gap-2.5"
    >
      {popups.map((popup, index) => (
        <NotificationPopupCard
          key={popup.item.id}
          popup={popup}
          depth={index}
          onDismiss={() => dismiss(popup.item.id)}
        />
      ))}
    </div>
  )
}

const ACCENT_BY_TYPE: Record<NotificationType, string> = {
  [NotificationType.NewSubmission]: 'var(--mri-red)',
  [NotificationType.ClaimCreated]: 'var(--mri-red)',
  [NotificationType.AssignedToMe]: 'var(--mri-red)',
  [NotificationType.OutcomeChanged]: 'var(--mri-red)',
  [NotificationType.CatalogAdded]: 'var(--mri-red)',
  [NotificationType.SubmissionRejected]: 'var(--mri-red)',
}

function accentColor(item: NotificationItem): string {
  if (
    item.type === NotificationType.OutcomeChanged &&
    item.data.outcome === ClaimOutcome.Accepted
  ) {
    return 'var(--mrg-ok)'
  }
  return ACCENT_BY_TYPE[item.type]
}

function NotificationPopupCard({
  popup,
  depth,
  onDismiss,
}: {
  popup: Popup
  depth: number
  onDismiss: () => void
}): React.ReactElement {
  const { item, isReminder } = popup
  const Icon = notificationIcon(item.type)
  const navigate = useNavigate()
  const markRead = useMarkNotificationRead()
  const snooze = useSnoozeNotification()
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [isHovered, setHovered] = useState(false)

  const paused = isHovered || snoozeMenuOpen

  useEffect(() => {
    if (paused) {
      return
    }
    const timer = window.setInterval(
      () => setElapsed((prev) => prev + TIMER_TICK_MS),
      TIMER_TICK_MS,
    )
    return () => window.clearInterval(timer)
  }, [paused])

  useEffect(() => {
    if (elapsed >= NOTIFICATION_POPUP_DURATION_MS) {
      onDismiss()
    }
  }, [elapsed, onDismiss])

  function open(): void {
    if (!item.isRead) {
      markRead.mutate(item.id)
    }
    onDismiss()
    const target = notificationTarget(item)
    if (target !== null) {
      navigate(target)
    }
  }

  function chooseSnooze(preset: NotificationSnoozePreset): void {
    snooze.mutate({ id: item.id, until: resolveSnoozeUntil(preset, new Date()) })
    setSnoozeMenuOpen(false)
    onDismiss()
  }

  const remaining = Math.max(0, 1 - elapsed / NOTIFICATION_POPUP_DURATION_MS)

  return (
    <div
      className={cn(
        'mri-glass mri-popup-in pointer-events-auto relative rounded-[16px]',
        depth > 0 && 'scale-[0.97] opacity-[0.92]',
      )}
      style={{ transformOrigin: 'top right' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: accentColor(item) }}
      />

      <button
        type="button"
        onClick={open}
        className="flex w-full items-start gap-3 py-3.5 pl-[17px] pr-3.5 text-left"
      >
        <Icon
          className="mt-0.5 size-[17px] flex-none"
          style={{ color: 'var(--mrg-icon)' }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[var(--mrg-text2)]">
            {isReminder
              ? m.notifications_eyebrow_reminder()
              : `${eyebrowFor(item)} · ${formatTimeAgo(item.createdAt, getLocale(), new Date())}`}
          </span>
          <span className="mt-1 block text-[13.5px] font-semibold leading-[1.4] text-[var(--mrg-text)]">
            {notificationTitle(item)}
          </span>
        </span>
      </button>

      <button
        type="button"
        aria-label={m.notifications_popup_close_aria()}
        onClick={onDismiss}
        className="absolute right-2.5 top-2.5 grid size-[22px] place-items-center rounded-[6px] text-[var(--mrg-text2)] transition-colors hover:bg-[var(--mrg-hover)] hover:text-[var(--mrg-text)]"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-4 pb-3 pl-[17px] pr-3.5">
        <button
          type="button"
          onClick={open}
          className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-mri-redh hover:underline"
        >
          {m.notifications_popup_open()} →
        </button>

        <SnoozeMenu
          open={snoozeMenuOpen}
          onOpenChange={setSnoozeMenuOpen}
          onChoose={chooseSnooze}
        />

        <button
          type="button"
          onClick={onDismiss}
          className="text-[12.5px] font-semibold text-[var(--mrg-text2)] transition-colors hover:text-[var(--mrg-text)]"
        >
          {m.notifications_popup_dismiss()}
        </button>
      </div>

      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--mrg-sep)]">
        <div
          className="h-full bg-mri-red opacity-70"
          style={{ width: `${remaining * 100}%`, transition: 'width 100ms linear' }}
        />
      </div>
    </div>
  )
}

function eyebrowFor(item: NotificationItem): string {
  const EYEBROWS: Record<NotificationType, () => string> = {
    [NotificationType.NewSubmission]: m.notifications_eyebrow_new_submission,
    [NotificationType.OutcomeChanged]: m.notifications_eyebrow_outcome_changed,
    [NotificationType.ClaimCreated]: m.notifications_eyebrow_claim_created,
    [NotificationType.AssignedToMe]: m.notifications_eyebrow_assigned_to_me,
    [NotificationType.CatalogAdded]: m.notifications_eyebrow_catalog_added,
    [NotificationType.SubmissionRejected]: m.notifications_eyebrow_submission_rejected,
  }
  return EYEBROWS[item.type]()
}

const SNOOZE_OPTIONS: { preset: NotificationSnoozePreset; label: () => string }[] = [
  { preset: NotificationSnoozePreset.FifteenMinutes, label: m.notifications_snooze_15m },
  { preset: NotificationSnoozePreset.OneHour, label: m.notifications_snooze_1h },
  { preset: NotificationSnoozePreset.ThreeHours, label: m.notifications_snooze_3h },
  { preset: NotificationSnoozePreset.TomorrowMorning, label: m.notifications_snooze_tomorrow },
]

function SnoozeMenu({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (preset: NotificationSnoozePreset) => void
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }
    function onPointerDown(event: MouseEvent): void {
      if (
        !(event.target instanceof Node) ||
        containerRef.current?.contains(event.target) === true
      ) {
        return
      }
      onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, onOpenChange])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-1 rounded-[7px] border border-[var(--mrg-sel-border)] bg-[var(--mrg-sel)] px-2 py-[3px] text-[12.5px] font-semibold text-[var(--mrg-text)]"
      >
        {m.notifications_snooze()}
        <span aria-hidden="true" className="text-[9px] opacity-70">
          ▾
        </span>
      </button>

      {open ? (
        <div className="mri-glass absolute left-0 top-[calc(100%+6px)] z-10 w-[196px] rounded-[12px] p-1.5">
          <p className="px-2.5 pb-[5px] pt-[7px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[var(--mrg-text2)]">
            {m.notifications_snooze_heading()}
          </p>
          {SNOOZE_OPTIONS.map((option) => (
            <button
              key={option.preset}
              type="button"
              onClick={() => onChoose(option.preset)}
              className="flex h-[34px] w-full items-center rounded-lg px-2.5 text-[13px] text-[var(--mrg-text)] transition-colors hover:bg-[var(--mrg-hover)]"
            >
              {option.label()}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
