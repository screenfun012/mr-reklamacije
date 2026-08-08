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

/**
 * The status the advance button moves to, or `null` at the end of the line. `preuzeto` is
 * terminal and the server answers a further advance with a 409, so hiding the button and
 * refusing the call agree instead of contradicting each other.
 */
export function nextIntakeStatus(current: IntakeOrderStatus): IntakeOrderStatus | null {
  return INTAKE_STATUS_ORDER[INTAKE_STATUS_ORDER.indexOf(current) + 1] ?? null
}

function timeOfDay(date: Date, intl: string): string {
  return new Intl.DateTimeFormat(intl, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function fullDate(date: Date, intl: string): string {
  return new Intl.DateTimeFormat(intl, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/** `25.07 · 09:14` — the handoff's list format, localized digits via Intl. */
export function formatIntakeReceivedAt(iso: string, locale: Locale): string {
  const date = new Date(iso)
  const intl = internalIntlLocale(locale)
  const day = new Intl.DateTimeFormat(intl, { day: '2-digit', month: '2-digit' }).format(date)
  return `${day} · ${timeOfDay(date, intl)}`
}

/**
 * `25.07.2026 · 09:14` — the detail's format. The list's short one drops the year, which is
 * fine for a work list and wrong for an archival read that is reachable from `Uklonjeni`, from
 * a direct link and later from the print.
 */
export function formatIntakeReceivedAtLong(iso: string, locale: Locale): string {
  const date = new Date(iso)
  const intl = internalIntlLocale(locale)
  return `${fullDate(date, intl)} · ${timeOfDay(date, intl)}`
}

/**
 * `25.07.2026. 09:14` in sr — a history row's stamp, space-joined as the prototype writes it
 * (`prijem-prototip-v2.dc.html:995`), because the ` · ` the two formats above use would fight the
 * `·` already sitting inside the status label beside it.
 *
 * The trailing dot after the year is CLDR's `dd.MM.y.` for `sr-Latn` and is KEPT deliberately: the
 * list and the Pregled card have shipped with it since day one, and making one screen disagree with
 * two live ones to match an ad-hoc string in the prototype is the worse trade.
 */
export function formatIntakeHistoryAt(iso: string, locale: Locale): string {
  const date = new Date(iso)
  const intl = internalIntlLocale(locale)
  return `${fullDate(date, intl)} ${timeOfDay(date, intl)}`
}
