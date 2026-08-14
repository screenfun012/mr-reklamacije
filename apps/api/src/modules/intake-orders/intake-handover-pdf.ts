import {
  INTAKE_HANDOVER_PAGE_CSS,
  IntakeHandoverSheet,
  type IntakePrintLocale,
} from '@mr/intake-document'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { PdfRenderer } from '../../core/pdf/pdf-renderer.js'
import { loadIntakeDocumentAssets } from './intake-document-assets.js'
import type { IntakeDocumentInput } from './intake-document-pdf.js'

/**
 * Both languages, Serbian first — the same decision as the work order's, for the same owner. He was
 * handed a bilingual paper when he left the car and there is no moment at which anyone chose a
 * language for him since.
 */
const DOCUMENT_LOCALES: readonly IntakePrintLocale[] = ['sr', 'en']

/**
 * The page number, drawn by Chromium in the bottom margin.
 *
 * This document paginates — measured 2026-08-14 at 1 / 3 / 6 pages for 3 / 25 / 80 rows — and a
 * three-page record with no page number makes a lost page invisible, which is the one thing a paper
 * that exists to prove what was done to a vehicle may not allow. The sheet cannot do it: a document
 * cannot count its own pages.
 *
 * Its own tiny stylesheet, and Arial rather than the document's Figtree: header and footer templates
 * render in a separate document that cannot see the page's `@font-face` rules, so naming Figtree here
 * would silently fall back to whatever the container has. An explicit `font-size` is load-bearing —
 * Chromium's default inside these templates is zero, and the footer would draw nothing at all.
 */
const FOOTER_TEMPLATE = `<div style="width:100%;padding:0 54px;font-family:Arial,sans-serif;font-size:8px;color:#54555b;text-align:center;">
  <span class="pageNumber"></span> / <span class="totalPages"></span>
</div>`

/**
 * Empty, and required. Turning the footer on turns the HEADER on with it, and Chromium's default
 * header is a date and the document's title stamped across the top of every page.
 */
const EMPTY_HEADER_TEMPLATE = '<div></div>'

/**
 * The handover record as one PDF — the work order's twin, drawn from the same component the screen
 * draws and wrapped the same way, with the fonts and the emblem carried as bytes.
 *
 * The one difference is the page box: this document GROWS, so it must not be given one. The `@page`
 * rule comes from the sheet itself (`INTAKE_HANDOVER_PAGE_CSS`), whose horizontal margin is zero
 * because every band runs edge to edge, and whose 12mm vertical margins are what a continuation page
 * has instead of a header — and now also what the page number is drawn into.
 */
export async function buildIntakeHandoverHtml(input: IntakeDocumentInput): Promise<string> {
  const { fontFaceCss, emblemDataUri } = await loadIntakeDocumentAssets()

  const sheets = DOCUMENT_LOCALES.map((locale) =>
    renderToStaticMarkup(
      createElement(IntakeHandoverSheet, {
        order: input.order,
        checklistItems: input.checklistItems,
        locale,
        logoSrc: emblemDataUri,
        id: `intake-handover-sheet-${locale}`,
      }),
    ),
  ).join('')

  return `<!doctype html>
<html lang="${DOCUMENT_LOCALES[0] as string}">
<head>
<meta charset="utf-8">
<style>${fontFaceCss}</style>
<style>
${INTAKE_HANDOVER_PAGE_CSS}
/* The reset the sheet used to get for free from the application it lived in — see the work order's
   wrapper for the measurement behind these two rules. */
*, *::before, *::after { box-sizing: border-box }
body { margin: 0 }
/*
 * Unlike the work order, neither sheet here is a known number of pages, so the seam between the two
 * languages cannot fall right on its own: without this the English copy starts halfway down the last
 * Serbian page and the owner is handed one paper that reads as two.
 */
#intake-handover-sheet-sr { break-after: page }
</style>
</head>
<body>${sheets}</body>
</html>`
}

/**
 * Renders it on the shared Chromium.
 *
 * `printBackground` for the same reason as the work order: without it every band prints white, and
 * the bands are what a reader navigates by. `preferCSSPageSize` makes the sheet's own `@page` the
 * single source of the page box — and NO `margin` option, deliberately: passing one would override
 * the 12mm the sheet asks for and drop every continuation page into the printer's unprintable strip.
 */
export async function renderIntakeHandoverPdf(
  renderer: PdfRenderer,
  input: IntakeDocumentInput,
): Promise<Buffer> {
  return renderer.renderDocument(await buildIntakeHandoverHtml(input), {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: EMPTY_HEADER_TEMPLATE,
    footerTemplate: FOOTER_TEMPLATE,
  })
}
