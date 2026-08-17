import { m } from '@mr/i18n'

import {
  emailButton,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '../../core/email/email-layout.js'

/** Max characters of the client's message shown in the notification email. */
const MESSAGE_EXCERPT_LIMIT = 400

/**
 * The one message that goes to the office rather than a customer, and it goes to ONE configured
 * address shared by the team — so there is no recipient whose language could be looked up. Serbian
 * is the shop's language; the English keys exist because both files must carry every key.
 */
const OFFICE_LOCALE = 'sr' as const

function excerpt(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length <= MESSAGE_EXCERPT_LIMIT) {
    return trimmed
  }
  return `${trimmed.slice(0, MESSAGE_EXCERPT_LIMIT)}…`
}

export function submissionNotificationSubject(firmName: string): string {
  return m.email_submission_subject({ firm: firmName }, { locale: OFFICE_LOCALE })
}

export function renderSubmissionNotificationHtml(params: {
  firmName: string
  message: string
  inboxUrl: string
  supportPhone: string
}): string {
  const firm = escapeHtml(params.firmName)
  const body = escapeHtml(excerpt(params.message))

  return renderEmailDocument({
    lang: OFFICE_LOCALE,
    preheader: m.email_submission_subject({ firm: params.firmName }, { locale: OFFICE_LOCALE }),
    supportPhone: params.supportPhone,
    bodyHtml: [
      // No full stop after the firm: half of them end in "d.o.o." and the sentence would close with
      // two.
      emailParagraph(
        m.email_submission_body({ firm: `<strong>${firm}</strong>` }, { locale: OFFICE_LOCALE }),
      ),
      // What the client actually wrote, set apart — in a bare paragraph it read as ours.
      `<div style="margin:0 0 14px;padding:12px 14px;background:#f3f4f6;border-left:3px solid #d1d5db;font-size:14px;line-height:1.6;color:#17171a;white-space:pre-wrap;">${body}</div>`,
      emailButton(params.inboxUrl, m.email_submission_button({}, { locale: OFFICE_LOCALE })),
    ].join(''),
  })
}
