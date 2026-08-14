import { m } from '@mr/i18n'
import {
  intakeChecklistCatalogFixture,
  intakeOrderDetailFixture,
} from '@mr/intake-document/testing'
import { describe, expect, it } from 'vitest'

import type { PdfPageOptions, PdfRenderer } from '../../../core/pdf/pdf-renderer.js'
import { buildIntakeDocumentHtml, renderIntakeDocumentPdf } from '../intake-document-pdf.js'

const document = async (): Promise<string> =>
  buildIntakeDocumentHtml({
    order: intakeOrderDetailFixture(),
    checklistItems: intakeChecklistCatalogFixture(),
  })

/**
 * The `@font-face` rules only. Naming a family in a `font-family:` declaration proves nothing — the
 * sheet names both of them on every element it draws — so an assertion that merely finds the name
 * somewhere in the document passes with the fonts entirely absent. (Written after a mutation proved
 * exactly that: deleting Figtree from the embedded set left this file green.)
 */
function embeddedFaces(html: string): { family: string; block: string }[] {
  return [...html.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => {
    const block = match[1] ?? ''
    return { family: /font-family:\s*'([^']+)'/.exec(block)?.[1] ?? '', block }
  })
}

/**
 * The document Chromium is handed. Everything here is about what it must CARRY, because it renders
 * with no network: a rule that points outward does not fail loudly, it renders wrong and quietly.
 */
describe('the intake document Chromium is handed', () => {
  it('carries every font as bytes, with nothing left pointing at a file', async () => {
    const html = await document()
    const faces = embeddedFaces(html)

    expect(faces.length).toBeGreaterThan(0)
    for (const face of faces) {
      expect(face.block).toContain('url(data:font/woff2;base64,')
    }
    expect(html).not.toContain('./files/')
  })

  it.each(['Figtree Variable', 'JetBrains Mono'])(
    'embeds %s for the subset the Serbian letters live in',
    async (family) => {
      const faces = embeddedFaces(await document()).filter((face) => face.family === family)

      // U+0100-02BA is `latin-ext`, where č ć ž š đ are. A family embedded as `latin` alone leaves no
      // hole in the paper — those five letters silently become whatever typeface the machine has,
      // which on a slim Debian container is not the one on the operator's screen. That is a live
      // defect in the claim-report PDF, and this document is not allowed to repeat it.
      expect(faces.filter((face) => face.block.includes('U+0100-02BA')).length).toBeGreaterThan(0)
    },
  )

  it('carries the emblem as bytes rather than a path only one app answers', async () => {
    const html = await document()

    expect(html).toContain('src="data:image/png;base64,')
    expect(html).not.toContain('/internal/logo-emblem-white.png')
  })

  it('states the page as the sheet, so nothing spills onto a second one', async () => {
    const html = await document()

    // 794x1123 and not A4: A4 at 96dpi is 793.7 x 1122.52px, and a page smaller than the drawing
    // standing on it makes Chromium start another one.
    expect(html).toContain('@page { size: 794px 1123px; margin: 0 }')
    expect(html).toContain('box-sizing: border-box')
  })

  it('carries the order twice, once in each language, so nobody has to choose', async () => {
    const html = await document()

    // Serbian first: the shop's own language, and the page the overwhelming majority of owners read.
    expect(html.indexOf('id="intake-print-sheet-sr"')).toBeGreaterThan(-1)
    expect(html.indexOf('id="intake-print-sheet-en"')).toBeGreaterThan(
      html.indexOf('id="intake-print-sheet-sr"'),
    )
    expect(html).toContain(m.intake_print_title({}, { locale: 'sr' }))
    expect(html).toContain(m.intake_print_title({}, { locale: 'en' }))
  })

  it('breaks between the two languages rather than trusting them to land right', async () => {
    // Each sheet is exactly one page tall, so the seam falls where it should on its own — until
    // somebody adds a margin, and then a blank sheet appears between the two languages.
    expect(await document()).toContain('#intake-print-sheet-sr { break-after: page }')
  })

  /**
   * Asserted on the instruction rather than on the artifact, and deliberately.
   *
   * `printBackground` defaults to FALSE, and the only thing it costs to lose is the red: the section
   * bands and the defect markers come out white, on a page that still passes every other check here
   * — one page, right size, right fonts. There is no cheap way to read a fill colour back out of a
   * compressed PDF content stream, so what is pinned is that the flag is still being sent. A
   * measurement of the paper itself is a human looking at it, which is where it belongs.
   */
  it('asks for the backgrounds, without which the red bands print white', async () => {
    const sent: PdfPageOptions[] = []
    const recorder = {
      renderDocument: async (_html: string, options: PdfPageOptions) => {
        sent.push(options)
        return Buffer.from('%PDF-')
      },
    } as unknown as PdfRenderer

    await renderIntakeDocumentPdf(recorder, {
      order: intakeOrderDetailFixture(),
      checklistItems: intakeChecklistCatalogFixture(),
    })

    expect(sent[0]?.printBackground).toBe(true)
    expect(sent[0]?.margin).toEqual({ top: '0', right: '0', bottom: '0', left: '0' })
    // And NO footer. Supplying a template is what turns Chromium's page numbering on, and this
    // sheet is exactly one page by rule — "1 / 1" stamped on it would be noise on a signed document.
    // The handover record is the one that paginates and the one that asks for it.
    expect(sent[0]?.footerTemplate).toBeUndefined()
  })
})
