/** Where the emblem is served from. Email clients fetch it; nothing else in an email may be linked. */
const EMBLEM_URL = 'https://mrclaims.live/portal/logo-white.png'

/** The document's own colours — an email from MR should read as the paper's younger sibling. */
const BAND = '#17171a'
const INK = '#17171a'
const MUTED = '#54555b'
const RULE = '#ed1c24'
/**
 * Brand red, chosen by Nikola 2026-08-14 over the band's black. The brandbook keeps red off primary
 * buttons INSIDE the apps; an email is not one of them, and a red call to action is what an inbox
 * expects.
 */
const BUTTON = '#ed1c24'
const PAGE = '#f3f4f6'
const CARD = '#ffffff'

/**
 * Arial, not Figtree. Outlook blocks web fonts outright and Gmail ignores `@font-face`, so a brand
 * font in an email is a font nobody sees — the fallback is what ships, and naming it is the only way
 * to know which one that is.
 */
const FONT = "-apple-system, 'Segoe UI', Arial, sans-serif"

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** A body paragraph. Styled inline because Gmail drops `<style>` blocks on some accounts. */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">${html}</p>`
}

/** The same, quieter — expiry notes, "ignore this if it wasn't you", the second language. */
export function emailMutedParagraph(html: string): string {
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${MUTED};">${html}</p>`
}

/**
 * The one action an email may carry. A table and not an `<a>` with padding: Outlook collapses
 * padding on inline elements, which turns the button into underlined text.
 */
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
  <tr><td bgcolor="${BUTTON}" style="border-radius:6px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
  </td></tr>
</table>`
}

/** Between the two languages of a bilingual message. */
export function emailDivider(): string {
  return `<div style="height:1px;background:#e6e7e9;margin:22px 0;"></div>`
}

export interface EmailDocumentParams {
  /** `lang` on the root element. A bilingual message states its first language. */
  readonly lang: string
  /** The line shown beside the subject in the inbox list. Today that is the body's first sentence by accident. */
  readonly preheader: string
  readonly bodyHtml: string
  /** Shown in the footer beside the phone, when the recipient has an inbox that answers them. */
  readonly contactEmail?: string
  /**
   * The shop's number, from `app_settings` — passed in rather than imported, because the frame
   * lives in `core/` and may not read the database, and a footer that quietly kept the compiled
   * default would disagree with the same number on the portal the moment it was changed.
   */
  readonly supportPhone: string
}

/**
 * The frame every message from this system arrives in: a black band with the emblem, a white sheet,
 * a red rule above the footer — the intake document, at inbox width.
 *
 * Tables and inline styles throughout, because Outlook renders mail with Word's engine, where
 * `flex`, `grid` and most of `<style>` do not exist. 600px is the width every client shows without
 * horizontal scrolling.
 */
export function renderEmailDocument(params: EmailDocumentParams): string {
  const { lang, preheader, bodyHtml, contactEmail, supportPhone } = params
  const contact =
    contactEmail === undefined
      ? escapeHtml(supportPhone)
      : `${escapeHtml(supportPhone)} &nbsp;·&nbsp; <a href="mailto:${escapeHtml(contactEmail)}" style="color:${MUTED};">${escapeHtml(contactEmail)}</a>`

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <!-- Without these Apple Mail and Outlook invert the palette themselves and the black band turns to mud. -->
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
  </head>
  <body style="margin:0;padding:0;background:${PAGE};">
    <!-- The inbox preview line. The trailing spaces stop the client from pulling the body in after it. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(30)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="background:${PAGE};">
      <tr>
        <td align="center" style="padding:24px 12px;">

          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="width:600px;max-width:100%;background:${CARD};border-radius:10px;overflow:hidden;font-family:${FONT};">

            <tr>
              <td bgcolor="${BAND}" style="background:${BAND};padding:20px 28px;">
                <!-- Most clients block remote images until the reader allows them, so the alt text has to
                     carry the brand on its own. White and bold, it reads as a wordmark on the band. -->
                <img src="${EMBLEM_URL}" width="132" height="30" alt="MR ENGINES"
                     style="display:block;border:0;height:30px;width:auto;color:#ffffff;font-size:17px;font-weight:800;letter-spacing:0.04em;">
              </td>
            </tr>

            <tr>
              <td style="padding:28px 28px 8px;">${bodyHtml}</td>
            </tr>

            <tr>
              <td style="padding:0 28px 26px;">
                <div style="border-top:2.5px solid ${RULE};padding-top:14px;">
                  <div style="font-size:12px;line-height:1.6;color:${MUTED};">
                    <strong style="color:${INK};">MR Engines</strong> &nbsp;·&nbsp; ${contact}
                  </div>
                </div>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`
}
