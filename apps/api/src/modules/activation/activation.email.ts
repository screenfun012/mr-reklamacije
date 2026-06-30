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
  const safeUrl = escapeHtml(url)

  return `<!doctype html>
<html lang="${locale}">
  <body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <p>${m.email_activation_greeting({ name: safeName }, { locale })}</p>
    <p>${m.email_activation_body({}, { locale })}</p>
    <p>
      <a href="${safeUrl}" style="display: inline-block; padding: 12px 20px; background: #ED1C24; color: #ffffff; text-decoration: none; border-radius: 6px;">
        ${m.email_activation_button({}, { locale })}
      </a>
    </p>
    <p style="color: #667085; font-size: 13px;">${m.email_activation_expiry({}, { locale })}</p>
    <p style="color: #667085; font-size: 13px;">${m.email_activation_ignore({}, { locale })}</p>
  </body>
</html>`
}
