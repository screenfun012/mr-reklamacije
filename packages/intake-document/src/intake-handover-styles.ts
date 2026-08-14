import type { CSSProperties } from 'react'

import { DOCUMENT_FONT_MONO, DOCUMENT_FONT_SANS } from './intake-print-styles.js'

/**
 * The page box the handover record is drawn against, and the one thing about it a wrapper must not
 * invent: the header band and every section band run edge to edge, so the horizontal page margin has
 * to be ZERO and the inset comes from the sheet's own padding. The vertical margins are the paper's,
 * and they are what every page after the first has instead of a header — 12mm, so a continuation page
 * does not start inside a desktop printer's unprintable strip.
 *
 * Exported as a string rather than described in prose because the sheet and the wrapper are written
 * in different tasks: the contract travels with the thing that depends on it.
 *
 * MEASURED 2026-08-14, Chromium via `page.pdf({ preferCSSPageSize: true })`, by inflating the page
 * content streams of the produced PDF — the DOM knows nothing about pagination, so nothing here was
 * read off the screen:
 *
 *   · The printable box is 794 × 1032 px per page (A4 less the two 12mm margins), and a document of
 *     3 / 25 / 80 services+materials comes out at 1 / 3 / 6 pages.
 *   · THE HEADER DOES NOT REPEAT. The black band was found on page 1 and on no other page of the
 *     3-page and 6-page documents. Chromium has no `position: running()`, so this is the only
 *     outcome a sheet can produce on its own, and it is accepted: page one is the one that says what
 *     the document is, the rest are its list. The alternative is `headerTemplate`, which draws in
 *     the margin band and would need `PdfPageOptions` to carry it.
 *   · THERE IS NO PAGE NUMBER, and the sheet cannot add one — a document cannot count its own pages.
 *     Measured that `footerTemplate` fills the gap without touching this sheet: the same document
 *     rendered with `displayHeaderFooter: true` and a `pageNumber / totalPages` footer kept the very
 *     same content boxes (y 0 h 1032, y 1032 h 414) and grew by 5.1 KB — the footer draws inside the
 *     12mm bottom margin and pushes nothing. It needs three optional fields on `PdfPageOptions`,
 *     which `PdfRenderer` does not have today; whoever wires the handover PDF should add them,
 *     because without a page number a lost page is invisible.
 */
export const INTAKE_HANDOVER_PAGE_CSS = '@page { size: A4; margin: 12mm 0 }'

/**
 * Document 2 is NOT document 1 with a taller box.
 *
 * Everything that makes the work order a box of exact measurements — `height: 1123px`, `flex: 1` on
 * the body, `margin-top: auto` under the footer — is absent here on purpose. Those are the tools of a
 * page that may not grow, and in a document that paginates they do the opposite of what they say: a
 * flex body distributes leftover space that no longer exists, and an `auto` margin pins a footer to
 * the bottom of a box whose bottom is now somewhere in the middle of page two.
 *
 * What IS stated is the same as on the work order and for the same reasons: the two font families
 * (the API's wrapper has no `<html>` to inherit them from), `overflow-wrap` (an unbroken 40-character
 * owner name must wrap inside its column), and `print-color-adjust` (without it the printer drops
 * every red band, and the bands are what a reader navigates by).
 */
export const HANDOVER_STYLE = {
  page: {
    backgroundColor: '#fff',
    color: '#17171a',
    fontFamily: DOCUMENT_FONT_SANS,
    fontSize: '16px',
    lineHeight: 1.6,
    overflowWrap: 'break-word',
    textRendering: 'optimizeLegibility',
    WebkitFontSmoothing: 'antialiased',
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
  },

  /** Plain block flow, not flex: the blocks inside it are meant to break across pages. */
  body: { paddingLeft: '54px', paddingRight: '54px', paddingTop: '18px' },

  section: { marginTop: '20px' },
  /** Between the blocks that share one band — basics, condition, defects under PRIMLJENO. */
  block: { marginTop: '12px' },

  /**
   * One row of a list that may be forty rows long. `break-inside: avoid` here is the reliable kind —
   * the row is a block in normal flow, not a flex child (`docs/25`: `break-inside` inside a flex
   * layout is not to be trusted) — so a wrapped service never has its first line on one page and its
   * second on the next.
   */
  row: {
    display: 'flex',
    breakInside: 'avoid',
    gap: '12px',
    borderColor: '#e6e7e9',
    borderBottomStyle: 'solid',
    borderBottomWidth: '1px',
    paddingTop: '5px',
    paddingBottom: '5px',
    fontSize: '12px',
  },
  rowNumber: {
    width: '22px',
    flex: 'none',
    fontFamily: DOCUMENT_FONT_MONO,
    fontWeight: 700,
    color: '#54555b',
  },
  rowText: { flex: 1 },
  rowZone: { color: '#54555b' },
  empty: { marginTop: '9px', fontSize: '11.5px', color: '#54555b' },

  /**
   * The declaration and the two signatures, kept together as one unbreakable block.
   *
   * `break-inside: avoid` is trusted here on MEASUREMENT, not on the spec — `docs/25` records it as
   * unreliable, and that was in a FLEX layout. This block is a plain block in normal flow, which is
   * the difference. Swept 30…82 services through Chromium 2026-08-14 and read which page each half
   * landed on from the PDF's content streams: with the rule stripped out, the red rule and the
   * statement print on page 2 while both signatures print on page 3 at 47, 48, 81 and 82 services —
   * the owner signs under nothing. With the rule in place, all 53 inputs kept the rule and both
   * signatures on one page; where it no longer fitted (46, 80) the whole block moved to the next.
   */
  closing: {
    breakInside: 'avoid',
    marginTop: '26px',
    borderColor: '#ed1c24',
    borderTopStyle: 'solid',
    borderTopWidth: '2.5px',
    paddingTop: '14px',
  },
  /**
   * Black and at reading size, unlike the work order's grey legal line: this is the one sentence on
   * the paper the owner is actually signing, not a note about the document.
   */
  statement: { margin: 0, marginBottom: '20px', maxWidth: '620px', fontSize: '11.5px' },
  signatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '40px',
  },
} satisfies Record<string, CSSProperties>
