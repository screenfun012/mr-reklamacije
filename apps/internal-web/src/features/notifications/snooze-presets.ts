import { NOTIFICATION_TOMORROW_HOUR, NotificationSnoozePreset } from '@mr/shared'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/**
 * Turns a snooze preset into the absolute moment the popup becomes due again.
 * The client resolves it (not the server) because "tomorrow morning" means the
 * worker's local morning, and the server has no business guessing their timezone.
 */
export function resolveSnoozeUntil(preset: NotificationSnoozePreset, from: Date): Date {
  switch (preset) {
    case NotificationSnoozePreset.FifteenMinutes:
      return new Date(from.getTime() + 15 * MINUTE_MS)
    case NotificationSnoozePreset.OneHour:
      return new Date(from.getTime() + HOUR_MS)
    case NotificationSnoozePreset.ThreeHours:
      return new Date(from.getTime() + 3 * HOUR_MS)
    case NotificationSnoozePreset.TomorrowMorning: {
      const tomorrow = new Date(from)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(NOTIFICATION_TOMORROW_HOUR, 0, 0, 0)
      return tomorrow
    }
    default:
      throw new Error(`Unhandled snooze preset: ${String(preset)}`)
  }
}
