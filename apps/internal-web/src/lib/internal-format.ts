import type { Locale } from '@mr/i18n'

/** "PETAK · 04.07.2026" — mono caps date eyebrow above the dashboard H1. */
export function formatInternalDateEyebrow(now: Date, locale: Locale): string {
  const weekday = new Intl.DateTimeFormat(locale === 'sr' ? 'sr-RS' : 'en-GB', {
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
  return new Intl.DateTimeFormat(locale === 'sr' ? 'sr-Latn-RS' : 'en-GB', { month: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
}
