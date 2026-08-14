import { m } from '@mr/i18n'

import {
  emailDivider,
  emailMutedParagraph,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '../../core/email/email-layout.js'

/**
 * Both languages, in the subject and in the body, for the same reason the document itself carries
 * both: nobody knows which one this owner reads, and there is no moment at which anyone chose. He is
 * not a user of anything — no account, no portal, no preference to look up — so the message has to
 * be readable on arrival or not at all.
 */
export function intakeDocumentEmailSubject(orderNumber: string): string {
  return `${m.email_intake_document_subject({ number: orderNumber }, { locale: 'sr' })} / ${m.email_intake_document_subject({ number: orderNumber }, { locale: 'en' })}`
}

/**
 * The message around the file, and deliberately thin: the document is the point, and everything
 * worth saying is already printed on it and signed. No button — the owner has nothing to sign in to,
 * and no contact email in the footer for the same reason; the workshop's phone is what answers him.
 */
export function renderIntakeDocumentEmailHtml(orderNumber: string): string {
  const number = escapeHtml(orderNumber)
  const bodyHtml = [
    ...(['sr', 'en'] as const).flatMap((locale, index) => [
      index === 0 ? '' : emailDivider(),
      emailParagraph(m.email_intake_document_greeting({}, { locale })),
      emailParagraph(m.email_intake_document_body({ number }, { locale })),
    ]),
    emailDivider(),
    emailMutedParagraph(m.email_intake_document_footer({}, { locale: 'sr' })),
    emailMutedParagraph(m.email_intake_document_footer({}, { locale: 'en' })),
  ].join('')

  return renderEmailDocument({
    lang: 'sr',
    preheader: m.email_intake_document_subject({ number: orderNumber }, { locale: 'sr' }),
    bodyHtml,
  })
}

/** What the file is called in the owner's inbox: the number written on his paper. */
export function intakeDocumentFileName(orderNumber: string): string {
  return `${orderNumber.replaceAll('/', '-')}.pdf`
}
