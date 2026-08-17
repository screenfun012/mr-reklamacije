import type { Locale } from '@mr/i18n'

/**
 * The BCP-47 tag every `Intl` call in this repo's intake surfaces must use.
 *
 * Neither bare tag is ever what we want, and each fails in its own direction: plain `sr` resolves to
 * CYRILLIC (this once printed "ЧЕТВРТАК" while every other word on the screen was Latin), and plain
 * `en` is US English, which writes `07/25/2026` — a serviser reading a work order in a hurry cannot
 * tell that from `25.07`.
 *
 * It lives in this package rather than in internal-web because the printed sheet formats a date, and
 * the sheet is now rendered by the API too. `apps/internal-web/src/lib/internal-format.ts` re-exports
 * it so its other callers are untouched — and so there is still exactly one definition.
 */
export function intakeIntlLocale(locale: Locale): string {
  return locale === 'sr' ? 'sr-Latn-RS' : 'en-GB'
}

/**
 * The shop's clock, and every intake time is written in it — never in the machine's.
 *
 * The sheet is rendered by the API as well as by the screen, and the API runs on Railway in UTC.
 * Without this the printed work order and the PDF mailed to the owner said a car received at 09:14
 * arrived at 07:14, and a car received after 22:00 got yesterday's DATE — on the document the owner
 * signs and keeps. On the tablet, which is set to Belgrade, the same code looked correct, so the
 * only place it was ever wrong was the one place nobody looks at while developing.
 *
 * Hardcoded rather than configured: there is one shop, it is in Belgrade, and a time zone that can
 * be set wrong is worse than one that cannot be set at all.
 */
const SHOP_TIME_ZONE = 'Europe/Belgrade'

function timeOfDay(date: Date, intl: string): string {
  return new Intl.DateTimeFormat(intl, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: SHOP_TIME_ZONE,
  }).format(date)
}

function fullDate(date: Date, intl: string): string {
  return new Intl.DateTimeFormat(intl, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: SHOP_TIME_ZONE,
  }).format(date)
}

/**
 * `25.07.2026 · 09:14` — the archival format. The list's short one drops the year, which is fine for
 * a work list and wrong for a document somebody keeps.
 */
export function formatIntakeReceivedAtLong(iso: string, locale: Locale): string {
  const date = new Date(iso)
  const intl = intakeIntlLocale(locale)
  return `${fullDate(date, intl)} · ${timeOfDay(date, intl)}`
}
