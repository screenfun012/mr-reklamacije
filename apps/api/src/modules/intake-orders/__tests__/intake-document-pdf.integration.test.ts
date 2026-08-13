import {
  intakeChecklistCatalogFixture,
  intakeOrderDetailFixture,
} from '@mr/intake-document/testing'
import { afterAll, describe, expect, it } from 'vitest'

import { PdfRenderer } from '../../../core/pdf/pdf-renderer.js'
import { renderIntakeDocumentPdf } from '../intake-document-pdf.js'

const renderer = new PdfRenderer()

afterAll(async () => {
  await renderer.dispose()
})

async function renderPdf(): Promise<Buffer> {
  return renderIntakeDocumentPdf(renderer, {
    order: intakeOrderDetailFixture(),
    checklistItems: intakeChecklistCatalogFixture(),
    locale: 'sr',
  })
}

/**
 * A real Chromium, as the claim-report export is already tested. The assertions are about the
 * artifact rather than the markup — the markup's own test cannot see a page that split in two or a
 * font that never made it in.
 */
describe('the signed work order as a PDF', () => {
  it('is one page, and one page only', async () => {
    const pdf = await renderPdf()
    const raw = pdf.toString('latin1')

    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    // The whole document is built on being a single sheet — the defect list flows into two columns
    // rather than run over, and both signatures sit at its foot. A second page means something on it
    // grew past the paper, and the half the customer signs is the half that would move.
    expect(raw).toMatch(/\/Count\s+1\b/)
  })

  it('is the page the sheet was drawn for, not a page it was fitted into', async () => {
    const raw = (await renderPdf()).toString('latin1')

    // 794 x 1123 CSS px in PDF points, which is what `preferCSSPageSize` plus the document's own
    // `@page` produces. Chromium rounds the last hundredth; anything further off means the page size
    // came from somewhere other than the document, and the sheet is being scaled.
    const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(raw)
    expect(box).not.toBeNull()
    expect(Number(box?.[1])).toBeCloseTo((794 / 96) * 72, 0)
    expect(Number(box?.[2])).toBeCloseTo((1123 / 96) * 72, 0)
  })

  it('carries its own two typefaces, so the container does not choose them', async () => {
    const raw = (await renderPdf()).toString('latin1')

    expect(raw).toContain('Figtree')
    expect(raw).toContain('JetBrainsMono')
  })
})
