import { PORTAL_SUPPORT_PHONE } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { renderActivationEmailHtml } from '../../../modules/activation/activation.email.js'
import { renderSubmissionNotificationHtml } from '../../../modules/client-submissions/client-submissions.email.js'
import { renderOutcomeChangedEmailHtml } from '../../../modules/emotive-claims/emotive-claims.email.js'
import { renderIntakeDocumentEmailHtml } from '../../../modules/intake-orders/intake-orders.email.js'
import { emailButton, emailParagraph, renderEmailDocument } from '../email-layout.js'

/**
 * Deliberately NOT the compiled default: the number an admin sets has to travel from `app_settings`
 * all the way into the footer, and asserting the default would pass even if nothing was threaded.
 */
const CONFIGURED_PHONE = '011/222-3344'
const CONFIGURED_EMAIL = 'podrska@example.test'

const EVERY_MESSAGE_THIS_SYSTEM_SENDS: readonly [string, () => string][] = [
  ['intake document', () => renderIntakeDocumentEmailHtml('RN-6137/26', CONFIGURED_PHONE)],
  [
    'activation',
    () =>
      renderActivationEmailHtml({
        name: 'Milan Petrović',
        url: 'https://mrclaims.live/activate?token=abc',
        locale: 'sr',
        supportPhone: CONFIGURED_PHONE,
        supportEmail: CONFIGURED_EMAIL,
      }),
  ],
  [
    'outcome changed',
    () =>
      renderOutcomeChangedEmailHtml({
        name: 'Karl Weber',
        mrNumber: 'MR-7167',
        url: 'https://mrclaims.live/claims/1',
        locale: 'en',
        supportPhone: CONFIGURED_PHONE,
        supportEmail: CONFIGURED_EMAIL,
      }),
  ],
  [
    'new submission',
    () =>
      renderSubmissionNotificationHtml({
        firmName: 'Autoprevoz Šabac d.o.o.',
        message: 'Motor kuca na hladno.',
        inboxUrl: 'https://internal.mrclaims.live/pristiglo',
        supportPhone: CONFIGURED_PHONE,
      }),
  ],
]

describe('every message this system sends', () => {
  it.each(EVERY_MESSAGE_THIS_SYSTEM_SENDS)('%s arrives in the frame', (_name, render) => {
    const html = render()

    // The band, the red rule and the phone — the three things that make it recognisably from MR.
    expect(html).toContain('#17171a')
    expect(html).toContain('border-top:2.5px solid #ed1c24')
    // The configured number, and NOT the one compiled into the code: a message still carrying the
    // default would disagree with the same number on the portal the moment an admin changed it.
    expect(html).toContain(CONFIGURED_PHONE)
    expect(html).not.toContain(PORTAL_SUPPORT_PHONE)
  })

  it.each(EVERY_MESSAGE_THIS_SYSTEM_SENDS)(
    '%s says what it is before it is opened',
    (_n, render) => {
      // The inbox shows a preview line beside the subject. Without one the client takes the first
      // text in the document, which here is markup and boilerplate.
      const preheader = /<div style="display:none[^"]*">([^<&]+)/.exec(render())?.[1]

      expect(preheader?.trim().length ?? 0).toBeGreaterThan(10)
    },
  )

  it.each(EVERY_MESSAGE_THIS_SYSTEM_SENDS)('%s keeps its own palette', (_name, render) => {
    // Without this Apple Mail and Outlook invert the colours themselves and the black band, which
    // is the whole header, turns to mud.
    expect(render()).toContain('name="color-scheme" content="light"')
  })
})

describe('the layout', () => {
  it('lets nothing a stranger typed become markup', () => {
    // The client's own words reach the office inside this message, and the firm name reaches it
    // from a form. Neither may open a tag.
    const html = renderSubmissionNotificationHtml({
      firmName: '<script>alert(1)</script>',
      message: '<img src=x onerror=alert(1)>',
      inboxUrl: 'https://internal.mrclaims.live/pristiglo',
      supportPhone: CONFIGURED_PHONE,
    })

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })

  it('draws the button as a table, because Outlook drops padding off a link', () => {
    const button = emailButton('https://example.test', 'Otvori')

    expect(button).toContain('<table')
    expect(button).toContain('bgcolor="#ed1c24"')
  })

  it('names the phone alone when there is no inbox that answers', () => {
    const html = renderEmailDocument({
      lang: 'sr',
      preheader: 'Test',
      bodyHtml: emailParagraph('Test'),
      supportPhone: CONFIGURED_PHONE,
    })

    expect(html).toContain(CONFIGURED_PHONE)
    expect(html).not.toContain('mailto:')
  })
})
