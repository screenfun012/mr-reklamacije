import { m } from '@mr/i18n'
import type { Locale } from '@mr/i18n'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function outcomeChangedEmailSubject(mrNumber: string, locale: Locale): string {
  return m.email_outcome_changed_subject({ mrNumber }, { locale })
}

/**
 * Signal-only notification (docs/05 philosophy): the email says the status
 * changed and links to the portal — it never carries the outcome itself or
 * any claim content beyond the MR number the client already knows.
 */
export function renderOutcomeChangedEmailHtml(params: {
  name: string
  mrNumber: string
  url: string
  locale: Locale
}): string {
  const { name, mrNumber, url, locale } = params
  const safeName = escapeHtml(name)
  const safeMrNumber = escapeHtml(mrNumber)
  const safeUrl = escapeHtml(url)

  return `<!doctype html>
<html lang="${locale}">
  <body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <p>${m.email_outcome_changed_greeting({ name: safeName }, { locale })}</p>
    <p>${m.email_outcome_changed_body({ mrNumber: safeMrNumber }, { locale })}</p>
    <p>
      <a href="${safeUrl}" style="display: inline-block; padding: 12px 20px; background: #ED1C24; color: #ffffff; text-decoration: none; border-radius: 6px;">
        ${m.email_outcome_changed_button({}, { locale })}
      </a>
    </p>
  </body>
</html>`
}
