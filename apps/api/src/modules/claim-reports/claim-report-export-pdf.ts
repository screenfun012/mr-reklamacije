import { ServiceUnavailableError } from '../../core/errors/domain-errors.js'
import type { PdfRenderer } from '../../core/pdf/pdf-renderer.js'
import { getClaimReportExportFontFaceCss } from './claim-report-export-font.js'
import { wrapClaimReportExportHtml } from './claim-report-export-styles.js'

const PDF_UNAVAILABLE_MESSAGE =
  'PDF izvoz trenutno nije dostupan. Koristite štampu iz pregleda izveštaja.'

/**
 * The claim report as a PDF: this document's own fonts, wrapper and page geometry, handed to the
 * shared browser in `core/pdf`.
 *
 * The knowledge stayed here rather than moving into the renderer with it. A4 with 20/15 mm margins
 * is a fact about THIS document — the intake work order is a pixel-exact box with no margin at all —
 * and a renderer that knew both would have to be told which one it was drawing anyway.
 *
 * The 503 message is re-stated for the same reason: the shared renderer cannot name a screen it has
 * never heard of, and "use the print button in the report preview" is the one sentence that gets the
 * operator their document anyway.
 */
export async function renderClaimReportPdf(
  renderer: PdfRenderer,
  bodyHtml: string,
): Promise<Buffer> {
  const fontFaceCss = await getClaimReportExportFontFaceCss()
  const htmlDocument = wrapClaimReportExportHtml(bodyHtml, fontFaceCss)

  try {
    return await renderer.renderDocument(htmlDocument, {
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    })
  } catch (error) {
    throw new ServiceUnavailableError(PDF_UNAVAILABLE_MESSAGE, { cause: error })
  }
}
