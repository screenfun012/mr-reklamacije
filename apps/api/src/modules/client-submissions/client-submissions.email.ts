/** Max characters of the client's message shown in the notification email. */
const MESSAGE_EXCERPT_LIMIT = 400

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function excerpt(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length <= MESSAGE_EXCERPT_LIMIT) {
    return trimmed
  }
  return `${trimmed.slice(0, MESSAGE_EXCERPT_LIMIT)}…`
}

export function submissionNotificationSubject(firmName: string): string {
  return `Nova prijava — ${firmName}`
}

export function renderSubmissionNotificationHtml(params: {
  firmName: string
  message: string
  inboxUrl: string
}): string {
  const firm = escapeHtml(params.firmName)
  const body = escapeHtml(excerpt(params.message))
  const url = escapeHtml(params.inboxUrl)

  return [
    '<div style="font-family: sans-serif; line-height: 1.5;">',
    `<p>Nova prijava sa klijentskog portala od firme <strong>${firm}</strong>.</p>`,
    `<p style="white-space: pre-wrap;">${body}</p>`,
    `<p><a href="${url}">Otvori Pristiglo</a></p>`,
    '</div>',
  ].join('')
}
