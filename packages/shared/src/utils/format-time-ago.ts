/**
 * "pre 2 min" / "2 min ago" — coarse relative time for notification rows.
 * Anything under a minute reads as "now" via `numeric: 'auto'`.
 *
 * (`apps/portal-web` keeps its own uppercase variant for the activity feed; this
 * one is the plain-case version the internal app uses.)
 */
export function formatTimeAgo(iso: string, locale: 'sr' | 'en', now: Date): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) {
    return ''
  }

  const diffMs = then - now.getTime()
  const diffMinutes = Math.round(diffMs / 60_000)
  const diffHours = Math.round(diffMs / 3_600_000)
  const diffDays = Math.round(diffMs / 86_400_000)

  const rtf = new Intl.RelativeTimeFormat(locale === 'sr' ? 'sr-RS' : 'en', { numeric: 'auto' })
  if (Math.abs(diffDays) >= 1) {
    return rtf.format(diffDays, 'day')
  }
  if (Math.abs(diffHours) >= 1) {
    return rtf.format(diffHours, 'hour')
  }
  return rtf.format(diffMinutes, 'minute')
}
