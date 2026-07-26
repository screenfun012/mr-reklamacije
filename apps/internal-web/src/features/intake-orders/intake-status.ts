import { m } from '@mr/i18n'
import { IntakeOrderStatus } from '@mr/shared'

import type { InternalPillTone } from '~/components/internal-pill'

/**
 * Status → pill tone. Verified against the handoff's palette: Primljeno blue, U radu amber,
 * Gotovo green, Preuzeto the muted archived tone. No new tokens (docs/25 §3.1).
 */
export const INTAKE_STATUS_TONES: Record<IntakeOrderStatus, InternalPillTone> = {
  [IntakeOrderStatus.Received]: 'info',
  [IntakeOrderStatus.InProgress]: 'warn',
  [IntakeOrderStatus.Done]: 'ok',
  [IntakeOrderStatus.PickedUp]: 'archived',
}

export const INTAKE_STATUS_LABELS: Record<IntakeOrderStatus, () => string> = {
  [IntakeOrderStatus.Received]: m.intake_status_primljeno,
  [IntakeOrderStatus.InProgress]: m.intake_status_u_radu,
  [IntakeOrderStatus.Done]: m.intake_status_gotovo,
  [IntakeOrderStatus.PickedUp]: m.intake_status_preuzeto,
}

export const INTAKE_STATUS_ORDER = [
  IntakeOrderStatus.Received,
  IntakeOrderStatus.InProgress,
  IntakeOrderStatus.Done,
  IntakeOrderStatus.PickedUp,
] as const

/** `25.07 · 09:14` — the handoff's list format, localized digits via Intl. */
export function formatIntakeReceivedAt(iso: string, locale: string): string {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(date)
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${day} · ${time}`
}
