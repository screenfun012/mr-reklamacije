import type { Locale } from '@mr/i18n'

/**
 * Neither bare tag is ever what this app wants, and each fails in its own direction: plain `sr`
 * resolves to CYRILLIC (this once printed "ЧЕТВРТАК" while every other word on the screen was
 * Latin), and plain `en` is US English, which writes `07/25/2026` — a serviser reading a work
 * order in a hurry cannot tell that from `25.07`. Every `Intl` call in internal-web goes through
 * here, so the two halves cannot be got right one at a time.
 */
export function internalIntlLocale(locale: Locale): string {
  return locale === 'sr' ? 'sr-Latn-RS' : 'en-GB'
}

/** "PETAK · 04.07.2026" — mono caps date eyebrow above a screen's H1. */
export function formatInternalDateEyebrow(now: Date, locale: Locale): string {
  const weekday = new Intl.DateTimeFormat(internalIntlLocale(locale), {
    weekday: 'long',
  }).format(now)
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${weekday.toUpperCase()} · ${day}.${month}.${now.getFullYear()}`
}

/** Short month name for chart axes ("JUL", "AVG" / "AUG"), locale-aware. */
export function formatInternalChartMonth(isoMonth: string, locale: Locale): string {
  const [year, month] = isoMonth.split('-')
  if (!year || !month) {
    return isoMonth
  }
  const date = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat(internalIntlLocale(locale), { month: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
}
