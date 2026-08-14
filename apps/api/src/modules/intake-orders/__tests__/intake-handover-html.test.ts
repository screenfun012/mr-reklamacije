import { m } from '@mr/i18n'
import { INTAKE_HANDOVER_PAGE_CSS } from '@mr/intake-document'
import {
  intakeChecklistCatalogFixture,
  intakeOrderDetailFixture,
} from '@mr/intake-document/testing'
import { describe, expect, it } from 'vitest'

import type { PdfPageOptions, PdfRenderer } from '../../../core/pdf/pdf-renderer.js'
import { buildIntakeHandoverHtml, renderIntakeHandoverPdf } from '../intake-handover-pdf.js'

const HANDED_OVER = {
  handoverTechnicianName: 'Marko Marković',
  handoverTechnicianSignature: 'M 0 0 L 10 10',
  handoverOwnerSignature: 'M 0 0 L 20 20',
  handoverSignedAt: '2026-08-15T10:00:00.000Z',
}

const document = async (): Promise<string> =>
  buildIntakeHandoverHtml({
    order: intakeOrderDetailFixture(HANDED_OVER),
    checklistItems: intakeChecklistCatalogFixture(),
  })

/**
 * The wrapper around the handover sheet. The sheet has its own tests; what only this layer decides
 * is the page box, the seam between the two languages, and the page number — and every one of those
 * fails silently rather than loudly.
 */
describe('the handover document Chromium is handed', () => {
  it('takes the page box from the sheet rather than inventing one', async () => {
    // Injected, not retyped: the horizontal margin has to stay 0 or the full-bleed bands stop being
    // full-bleed, and that measurement lives with the sheet that was measured against it.
    expect(await document()).toContain(INTAKE_HANDOVER_PAGE_CSS)
  })

  it('carries the record twice, once in each language, and breaks between them', async () => {
    const html = await document()

    expect(html.indexOf('id="intake-handover-sheet-sr"')).toBeGreaterThan(-1)
    expect(html.indexOf('id="intake-handover-sheet-en"')).toBeGreaterThan(
      html.indexOf('id="intake-handover-sheet-sr"'),
    )
    expect(html).toContain(m.intake_handover_title({}, { locale: 'sr' }))
    expect(html).toContain(m.intake_handover_title({}, { locale: 'en' }))
    // Neither half is a known number of pages here, so the seam cannot fall right on its own.
    expect(html).toContain('#intake-handover-sheet-sr { break-after: page }')
  })

  it('names the person who handed the vehicle over, under his own signature', async () => {
    // The whole reason the name is on the wire: a signature over an empty caption says nothing
    // about who gave the car back.
    expect(await document()).toContain('Marko Marković')
  })

  it('prints the owner remark whole, however long he made it', async () => {
    // The 180-character ceiling belongs to the one-page work order. Here it would put a `…` on the
    // paper the owner signs when taking his car back — over his own words about what was wrong with
    // it, which is the first thing reached for in a dispute.
    const remark = `Kvačilo proklizava ${'x'.repeat(400)} kraj`
    const note = `U gepeku ${'y'.repeat(400)} kraj`
    const html = await buildIntakeHandoverHtml({
      order: intakeOrderDetailFixture({
        ...HANDED_OVER,
        ownerRemarks: remark,
        equipmentNote: note,
      }),
      checklistItems: intakeChecklistCatalogFixture(),
    })

    expect(html).toContain(remark)
    expect(html).toContain(note)
    expect(html).not.toContain('…')
  })

  /**
   * Asserted on the instruction rather than on the artifact, like the work order's `printBackground`.
   * A real render was measured while this was written — 4 pages, A4 MediaBox, 9.3 KB larger with the
   * footer than without and not one page more — but reading a page number back out of a compressed
   * content stream in a subset font needs a PDF parser, and what can silently disappear here is the
   * instruction, not the drawing.
   *
   * Only the TEMPLATE is asserted, because it is now the only thing this document says: Chromium's
   * three switches are derived from it inside `PdfRenderer` (`headerFooterFor`, tested there).
   */
  it('asks for the page number, without which a lost page is invisible', async () => {
    const sent: PdfPageOptions[] = []
    const recorder = {
      renderDocument: async (_html: string, options: PdfPageOptions) => {
        sent.push(options)
        return Buffer.from('%PDF-')
      },
    } as unknown as PdfRenderer

    await renderIntakeHandoverPdf(recorder, {
      order: intakeOrderDetailFixture(HANDED_OVER),
      checklistItems: intakeChecklistCatalogFixture(),
    })

    expect(sent[0]?.printBackground).toBe(true)
    expect(sent[0]?.preferCSSPageSize).toBe(true)
    expect(sent[0]?.footerTemplate).toContain('class="pageNumber"')
    expect(sent[0]?.footerTemplate).toContain('class="totalPages"')
    // No margin option: it would override the 12mm the sheet asks for, and every continuation page
    // would start inside a desktop printer's unprintable strip.
    expect(sent[0]?.margin).toBeUndefined()
  })
})
