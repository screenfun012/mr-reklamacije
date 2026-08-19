/**
 * The shop's clock. Every date a person reads on a screen of ours is written in it, never in the
 * machine's: these screens are server-rendered on Railway, which runs in UTC, so between 22:00 and
 * midnight Belgrade an unpinned formatter greets the office with YESTERDAY's weekday and date, then
 * changes it on hydration.
 *
 * ⚠ `@mr/intake-document` states the same two facts (`INTAKE_SHOP_TIME_ZONE`, `intakeIntlLocale`)
 * for the printed work order, and internal-web re-exports them. Folding all three into one home is
 * its own task — it touches the package that renders the owner's signed document, and this file was
 * added during the admin restyle. Until then: change one, change the other.
 */
const SHOP_TIME_ZONE = 'Europe/Belgrade'

/**
 * The BCP-47 tag to hand `Intl`. Neither bare tag is ever right: plain `sr` resolves to CYRILLIC,
 * and plain `en` is US English, which writes `08/19/2026`.
 */
function intlLocale(locale: 'sr' | 'en'): string {
  return locale === 'sr' ? 'sr-Latn-RS' : 'en-GB'
}

/** "SREDA · 19.08.2026" — the mono caps line above a screen's heading. */
export function formatDateEyebrow(now: Date, locale: 'sr' | 'en'): string {
  const weekday = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    timeZone: SHOP_TIME_ZONE,
  }).format(now)
  // en-GB is always `dd/mm/yyyy`, so the dots are ours and not a locale's.
  const day = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: SHOP_TIME_ZONE,
  })
    .format(now)
    .replace(/\//g, '.')

  return `${weekday.toUpperCase()} · ${day}`
}

/**
 * Short month name for a chart axis ("JUL", "AVG" / "AUG") from an `YYYY-MM` bucket.
 *
 * No `timeZone` here on purpose: the Date is BUILT from a year and a month in local time and only
 * its month name is read, so there is no instant to shift.
 */
export function formatChartMonth(isoMonth: string, locale: 'sr' | 'en'): string {
  const [year, month] = isoMonth.split('-')
  if (!year || !month) {
    return isoMonth
  }

  const date = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
}
