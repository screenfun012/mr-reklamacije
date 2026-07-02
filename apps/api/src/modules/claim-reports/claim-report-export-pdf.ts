import { ServiceUnavailableError } from '../../core/errors/domain-errors.js'
import { getClaimReportExportFontFaceCss } from './claim-report-export-font.js'
import { wrapClaimReportExportHtml } from './claim-report-export-styles.js'

const PDF_UNAVAILABLE_MESSAGE =
  'PDF izvoz trenutno nije dostupan. Koristite štampu iz pregleda izveštaja.'

export async function renderClaimReportPdf(bodyHtml: string): Promise<Buffer> {
  const fontFaceCss = await getClaimReportExportFontFaceCss()
  const htmlDocument = wrapClaimReportExportHtml(bodyHtml, fontFaceCss)

  try {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })

    try {
      const page = await browser.newPage()
      await page.setContent(htmlDocument, { waitUntil: 'load' })
      await page.waitForFunction('document.fonts.ready')
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      })

      return Buffer.from(pdf)
    } finally {
      await browser.close()
    }
  } catch (error) {
    // Client gets the generic 503; the real failure (missing Chromium, render
    // crash, …) travels as `cause` and is logged by the global error handler.
    throw new ServiceUnavailableError(PDF_UNAVAILABLE_MESSAGE, { cause: error })
  }
}
