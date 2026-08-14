import { m } from '@mr/i18n'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

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
 * worth saying is already printed on it and signed. No link — the owner has nothing to sign in to.
 */
export function renderIntakeDocumentEmailHtml(orderNumber: string): string {
  const number = escapeHtml(orderNumber)
  const paragraphs = (['sr', 'en'] as const).map(
    (locale) => `    <p>${m.email_intake_document_greeting({}, { locale })}</p>
    <p>${m.email_intake_document_body({ number }, { locale })}</p>`,
  )

  return `<!doctype html>
<html lang="sr">
  <body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.5;">
${paragraphs.join('\n    <hr style="border: none; border-top: 1px solid #e6e7e9; margin: 20px 0;">\n')}
    <p style="color: #54555b; font-size: 12px;">
      ${m.email_intake_document_footer({}, { locale: 'sr' })}<br>
      ${m.email_intake_document_footer({}, { locale: 'en' })}
    </p>
  </body>
</html>`
}

/** What the file is called in the owner's inbox: the number written on his paper. */
export function intakeDocumentFileName(orderNumber: string): string {
  return `${orderNumber.replaceAll('/', '-')}.pdf`
}
