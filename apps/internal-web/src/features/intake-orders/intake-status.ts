import { m, type Locale } from '@mr/i18n'
import { IntakeOrderStatus } from '@mr/shared'

import type { InternalPillTone } from '~/components/internal-pill'
import { internalIntlLocale } from '~/lib/internal-format'

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
export function formatIntakeReceivedAt(iso: string, locale: Locale): string {
  const date = new Date(iso)
  const intl = internalIntlLocale(locale)
  const day = new Intl.DateTimeFormat(intl, { day: '2-digit', month: '2-digit' }).format(date)
  const time = new Intl.DateTimeFormat(intl, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${day} · ${time}`
}

/**
 * `25.07.2026 · 09:14` — the detail's format. The list's short one drops the year, which is
 * fine for a work list and wrong for an archival read that is reachable from `Uklonjeni`, from
 * a direct link and later from the print.
 */
export function formatIntakeReceivedAtLong(iso: string, locale: Locale): string {
  const date = new Date(iso)
  const intl = internalIntlLocale(locale)
  const day = new Intl.DateTimeFormat(intl, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
  const time = new Intl.DateTimeFormat(intl, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${day} · ${time}`
}
