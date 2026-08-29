import type { Locale } from '@mr/i18n'

/**
 * Design dates are always `DD.MM.YYYY` in mono, identical in both languages —
 * deliberately not `Intl` (sr-RS appends a trailing dot, en-GB uses slashes).
 */
export function formatPortalDate(value: string | null): string {
  if (value === null || value === '') {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${date.getUTCFullYear()}`
}

/** "THURSDAY · 03.07.2026" — the dashboard date eyebrow. */
export function formatPortalDateEyebrow(now: Date, locale: Locale): string {
  // sr-Latn, never bare sr-RS: plain Serbian resolves to CYRILLIC and greeted the
  // dashboard with СУБОТА (caught by Nikola, 2026-08-29).
  const weekday = new Intl.DateTimeFormat(locale === 'sr' ? 'sr-Latn-RS' : 'en-GB', {
    weekday: 'long',
  }).format(now)
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${weekday.toUpperCase()} · ${day}.${month}.${now.getFullYear()}`
}

/** "2 DAYS AGO" / "PRE 2 DANA" — mono caps timestamps in the activity feed. */
export function formatPortalTimeAgo(iso: string, locale: Locale, now: Date): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) {
    return ''
  }
  const diffMs = then - now.getTime()
  const diffMinutes = Math.round(diffMs / 60_000)
  const diffHours = Math.round(diffMs / 3_600_000)
  const diffDays = Math.round(diffMs / 86_400_000)

  const rtf = new Intl.RelativeTimeFormat(locale === 'sr' ? 'sr-Latn-RS' : 'en', {
    numeric: 'auto',
  })
  let label: string
  if (Math.abs(diffDays) >= 1) {
    label = rtf.format(diffDays, 'day')
  } else if (Math.abs(diffHours) >= 1) {
    label = rtf.format(diffHours, 'hour')
  } else {
    label = rtf.format(diffMinutes, 'minute')
  }
  return label.toUpperCase()
}

/**
 * Public claim identifier — the MR NUMBER exactly as entered in the internal
 * app (no added prefix). The design's `MR-` presentation prefix was removed:
 * mr_number values already carry their own form (e.g. `MR-3333`, `ONLY-EM-2/26`)
 * and prefixing produced `MR-MR-3333`. The portal must mirror the internal number.
 */
export function formatPortalClaimId(mrNumber: string | null, claimNumber: string | null): string {
  if (mrNumber !== null && mrNumber !== '') {
    return mrNumber
  }
  return claimNumber ?? '—'
}

/** Avatar initials from the company name ("AS Tajka" → "AT"). */
export function companyInitials(company: string): string {
  const words = company.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return 'MR'
  }
  const first = words[0]?.charAt(0) ?? ''
  const second = words[1]?.charAt(0) ?? words[0]?.charAt(1) ?? ''
  return (first + second).toUpperCase()
}

/**
 * Header company label: the linked firm, or the account's own name when the
 * account has no firm yet. Several firms collapse to "first +N" (docs/16 §5.3) —
 * the norm is one firm per account, but the day a second one is linked this
 * already reads correctly without a code change.
 *
 * Returns the LABEL only: avatar initials must be taken from the firm name
 * itself, or "AS Tajka +1" would initial as "A+".
 */
export function formatCompanyLabel(firmNames: readonly string[], fallback: string): string {
  // `?? fallback` would not catch a blank name — `''` is not nullish — and a
  // blank header reads as a bug rather than as a missing firm.
  const named = firmNames.filter((name) => name.trim() !== '')
  const primary = named[0]
  if (primary === undefined) {
    return fallback
  }
  return named.length > 1 ? `${primary} +${named.length - 1}` : primary
}
