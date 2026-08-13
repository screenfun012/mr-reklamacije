import { IntakePrintSheet, type IntakePrintLocale } from '@mr/intake-document'
import type { IntakeChecklistItemListItem, IntakeOrderDetail } from '@mr/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { PdfRenderer } from '../../core/pdf/pdf-renderer.js'
import { loadIntakeDocumentAssets } from './intake-document-assets.js'

/**
 * The page box, in the same unit the sheet is drawn in.
 *
 * NOT `size: A4`. A4 is 210x297mm, which at CSS's fixed 96dpi is 793.70 x 1122.52px — and the sheet
 * is a hard 794 x 1123, so asking for A4 hands the drawing a page very slightly smaller than itself.
 * Measured 2026-08-13 rather than assumed: it does NOT split onto a second page, it comes out as a
 * page whose box is not the sheet's box, with the last fraction of a pixel on each edge outside the
 * paper. Invisible, and exactly the kind of "almost" this document is not allowed to have — the one
 * thing every measurement of this sheet has been made against is that the page and the drawing are
 * the same object. Stating the box in pixels makes them the same object by construction. What
 * reaches the printer is 0.1% larger than A4, which no tray can tell from A4.
 */
const PAGE_SIZE_CSS = '794px 1123px'

export interface IntakeDocumentInput {
  readonly order: IntakeOrderDetail
  /**
   * The DISPLAY read of the catalog, so an item the office has since retired still prints under the
   * name it was answered by — the same list the preview draws from.
   */
  readonly checklistItems: readonly IntakeChecklistItemListItem[]
  /** Chosen when the paper was signed, not read from anyone's session. */
  readonly locale: IntakePrintLocale
}

/**
 * The work order as one PDF, drawn from the same component the preview draws — not a description of
 * it. `renderToStaticMarkup` and not `renderToString`: nothing here hydrates, and the hydration
 * markers would be dead weight in a document whose only reader is a printer.
 */
export async function buildIntakeDocumentHtml(input: IntakeDocumentInput): Promise<string> {
  const { fontFaceCss, emblemDataUri } = await loadIntakeDocumentAssets()

  const markup = renderToStaticMarkup(
    createElement(IntakePrintSheet, {
      order: input.order,
      checklistItems: input.checklistItems,
      locale: input.locale,
      logoSrc: emblemDataUri,
    }),
  )

  return `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<style>${fontFaceCss}</style>
<style>
@page { size: ${PAGE_SIZE_CSS}; margin: 0 }
/*
 * The reset the sheet used to get for free from the application it lived in, and the only two rules
 * of it that reach the paper. Measured 2026-08-13 by dumping every computed property of all 804
 * elements with the app's stylesheet and without it: box-sizing was the one difference that could
 * ever move a pixel. It moves none today — no box on the sheet carries both a size and padding — and
 * this is what keeps that true, so the screen and the paper cannot drift apart over a rule nobody
 * remembers is there.
 */
*, *::before, *::after { box-sizing: border-box }
body { margin: 0 }
</style>
</head>
<body>${markup}</body>
</html>`
}

/**
 * Renders that document on the shared Chromium.
 *
 * `printBackground` is load-bearing: it defaults to false, and without it the red section bands and
 * the red defect markers come out white — the two things a reader navigates the sheet by.
 *
 * `preferCSSPageSize` makes the `@page` rule above the single source of the page's size. Without it
 * the size arrives twice, from the CSS and from these options, and the pair that disagrees wins
 * silently.
 */
export async function renderIntakeDocumentPdf(
  renderer: PdfRenderer,
  input: IntakeDocumentInput,
): Promise<Buffer> {
  return renderer.renderDocument(await buildIntakeDocumentHtml(input), {
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  })
}
