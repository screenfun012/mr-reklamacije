import { m } from '@mr/i18n'
import type { Locale } from '@mr/i18n'
import { PORTAL_SUPPORT_EMAIL } from '@mr/shared'

import {
  emailButton,
  emailMutedParagraph,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '../../core/email/email-layout.js'

export function activationEmailSubject(locale: Locale): string {
  return m.email_activation_subject({}, { locale })
}

export function renderActivationEmailHtml(params: {
  name: string
  url: string
  locale: Locale
}): string {
  const { name, url, locale } = params
  const safeName = escapeHtml(name)

  return renderEmailDocument({
    lang: locale,
    preheader: m.email_activation_subject({}, { locale }),
    contactEmail: PORTAL_SUPPORT_EMAIL,
    bodyHtml: [
      emailParagraph(m.email_activation_greeting({ name: safeName }, { locale })),
      emailParagraph(m.email_activation_body({}, { locale })),
      emailButton(url, m.email_activation_button({}, { locale })),
      emailMutedParagraph(m.email_activation_expiry({}, { locale })),
      emailMutedParagraph(m.email_activation_ignore({}, { locale })),
    ].join(''),
  })
}
