import { INTAKE_SHOP_TIME_ZONE, intakeIntlLocale } from '@mr/intake-document'
import type { Locale } from '@mr/i18n'

/**
 * Re-exported, not defined: the printed work order formats a date too, and the API renders that
 * document now — so the one definition lives in `@mr/intake-document` where both sides can reach it.
 * Every `Intl` call in internal-web still goes through this module, so the two halves cannot be got
 * right one at a time.
 */
export { intakeIntlLocale as internalIntlLocale } from '@mr/intake-document'

/**
 * "PETAK · 04.07.2026" — mono caps date eyebrow above a screen's H1.
 *
 * In the shop's zone, like every other intake date (2026-08-17). `getDate()`/`getMonth()` read the
 * MACHINE's clock, and these screens are server-rendered on Railway in UTC — so between 22:00 and
 * midnight Belgrade the office would have been greeted with yesterday's weekday and yesterday's
 * date, then watched it change on hydration.
 */
export function formatInternalDateEyebrow(now: Date, locale: Locale): string {
  const weekday = new Intl.DateTimeFormat(intakeIntlLocale(locale), {
    weekday: 'long',
    timeZone: INTAKE_SHOP_TIME_ZONE,
  }).format(now)
  // en-GB is always `dd/mm/yyyy`, so the dots below are ours and not a locale's — this eyebrow has
  // never carried `sr-Latn`'s trailing dot and changing that would move two live screens.
  const day = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: INTAKE_SHOP_TIME_ZONE,
  })
    .format(now)
    .replace(/\//g, '.')
  return `${weekday.toUpperCase()} · ${day}`
}

/**
 * Short month name for chart axes ("JUL", "AVG" / "AUG"), locale-aware.
 *
 * No `timeZone` here on purpose: the Date is BUILT from a year and a month in local time and only
 * its month name is read, so there is no instant to shift and pinning a zone would be cargo cult.
 */
export function formatInternalChartMonth(isoMonth: string, locale: Locale): string {
  const [year, month] = isoMonth.split('-')
  if (!year || !month) {
    return isoMonth
  }
  const date = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat(intakeIntlLocale(locale), { month: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
}
