import { m } from '@mr/i18n'
import type { Locale } from '@mr/i18n'
import { PORTAL_SUPPORT_EMAIL } from '@mr/shared'

import {
  emailButton,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '../../core/email/email-layout.js'

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

  return renderEmailDocument({
    lang: locale,
    preheader: m.email_outcome_changed_subject({ mrNumber }, { locale }),
    contactEmail: PORTAL_SUPPORT_EMAIL,
    bodyHtml: [
      emailParagraph(m.email_outcome_changed_greeting({ name: safeName }, { locale })),
      emailParagraph(m.email_outcome_changed_body({ mrNumber: safeMrNumber }, { locale })),
      emailButton(url, m.email_outcome_changed_button({}, { locale })),
    ].join(''),
  })
}
