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

/**
 * `25.07.2026 · 09:14` — the archival format. The list's short one drops the year, which is fine for
 * a work list and wrong for a document somebody keeps.
 */
export function formatIntakeReceivedAtLong(iso: string, locale: Locale): string {
  const date = new Date(iso)
  const intl = intakeIntlLocale(locale)
  return `${fullDate(date, intl)} · ${timeOfDay(date, intl)}`
}
