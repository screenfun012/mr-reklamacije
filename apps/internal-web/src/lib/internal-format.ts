import { intakeIntlLocale } from '@mr/intake-document'
import type { Locale } from '@mr/i18n'

/**
 * Re-exported, not defined: the printed work order formats a date too, and the API renders that
 * document now — so the one definition lives in `@mr/intake-document` where both sides can reach it.
 * Every `Intl` call in internal-web still goes through this module, so the two halves cannot be got
 * right one at a time.
 */
export { intakeIntlLocale as internalIntlLocale } from '@mr/intake-document'

/** "PETAK · 04.07.2026" — mono caps date eyebrow above a screen's H1. */
export function formatInternalDateEyebrow(now: Date, locale: Locale): string {
  const weekday = new Intl.DateTimeFormat(intakeIntlLocale(locale), {
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
  return new Intl.DateTimeFormat(intakeIntlLocale(locale), { month: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
}
