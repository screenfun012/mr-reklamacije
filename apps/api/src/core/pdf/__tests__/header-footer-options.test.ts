import { describe, expect, it } from 'vitest'

import { headerFooterFor } from '../pdf-renderer.js'

/**
 * The one thing this function exists to make impossible: three Chromium switches disagreeing about
 * whether a document has a running footer. It used to be maintained by the ORDER of a spread, which
 * is not something a test can protect — so what is asserted here is that the flags are derived from
 * the template and cannot be set independently of it.
 */
describe('the header and footer Chromium is told about', () => {
  it('draws nothing when the document supplied no footer', () => {
    expect(headerFooterFor(undefined)).toEqual({ displayHeaderFooter: false })
  })

  it('turns the footer on, and blanks the header Chromium would otherwise invent', () => {
    // Turning the footer on turns the header on with it; without a blank template of ours Chromium
    // stamps its own date and title across the top of every page.
    expect(headerFooterFor('<span class="pageNumber"></span>')).toEqual({
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<span class="pageNumber"></span>',
    })
  })
})
