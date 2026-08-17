import { m } from '@mr/i18n'

import {
  emailDivider,
  emailMutedParagraph,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '../../core/email/email-layout.js'

/**
 * Both languages, in the subject and in the body, for the same reason the work order's message
 * carries both: the vehicle's owner is not a user of anything — no account, no portal, no preference
 * to look up — so the message has to be readable on arrival or not at all.
 *
 * The greeting and the footer are the work order's own keys, deliberately. They say nothing about
 * which document is attached, and two identical strings under two names is two strings that drift.
 */
export function intakeHandoverEmailSubject(orderNumber: string): string {
  return `${m.email_intake_handover_subject({ number: orderNumber }, { locale: 'sr' })} / ${m.email_intake_handover_subject({ number: orderNumber }, { locale: 'en' })}`
}

/** Thin, like its sibling: everything worth saying is printed on the sheet the owner signed. */
export function renderIntakeHandoverEmailHtml(orderNumber: string, supportPhone: string): string {
  const number = escapeHtml(orderNumber)
  const bodyHtml = [
    ...(['sr', 'en'] as const).flatMap((locale, index) => [
      index === 0 ? '' : emailDivider(),
      emailParagraph(m.email_intake_document_greeting({}, { locale })),
      emailParagraph(m.email_intake_handover_body({ number }, { locale })),
    ]),
    emailDivider(),
    emailMutedParagraph(m.email_intake_document_footer({}, { locale: 'sr' })),
    emailMutedParagraph(m.email_intake_document_footer({}, { locale: 'en' })),
  ].join('')

  return renderEmailDocument({
    lang: 'sr',
    preheader: m.email_intake_handover_subject({ number: orderNumber }, { locale: 'sr' }),
    bodyHtml,
    supportPhone,
  })
}

/**
 * What the file is called in the owner's inbox — and NOT what the work order is called.
 *
 * The same owner receives both papers under the same number, and a browser saving the second one
 * over the first is how a record disappears without anybody doing anything wrong.
 */
export function intakeHandoverFileName(orderNumber: string): string {
  return `${orderNumber.replaceAll('/', '-')}-primopredaja.pdf`
}
