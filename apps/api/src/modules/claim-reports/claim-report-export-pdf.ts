import type { Browser } from 'playwright'

import { ServiceUnavailableError } from '../../core/errors/domain-errors.js'
import { getClaimReportExportFontFaceCss } from './claim-report-export-font.js'
import { wrapClaimReportExportHtml } from './claim-report-export-styles.js'

const PDF_UNAVAILABLE_MESSAGE =
  'PDF izvoz trenutno nije dostupan. Koristite štampu iz pregleda izveštaja.'

// A Chromium instance costs ~1–3 s launch + hundreds of MB RSS. One shared
// browser (new context per render) removes the launch from every request; the
// slot cap keeps N concurrent exports from stacking N render pipelines.
const MAX_CONCURRENT_RENDERS = 2

/**
 * Renders claim-report HTML to PDF on a SHARED Chromium instance, capped at
 * MAX_CONCURRENT_RENDERS at a time. Construct once (DI container) and dispose
 * on shutdown. If the browser process dies, the next render relaunches it.
 */
export class ClaimReportPdfRenderer {
  private browserPromise: Promise<Browser> | null = null
  private activeRenders = 0
  private readonly waiting: Array<() => void> = []

  async render(bodyHtml: string): Promise<Buffer> {
    const fontFaceCss = await getClaimReportExportFontFaceCss()
    const htmlDocument = wrapClaimReportExportHtml(bodyHtml, fontFaceCss)

    await this.acquireSlot()
    try {
      try {
        return await this.renderWithSharedBrowser(htmlDocument)
      } catch (firstError) {
        // The shared browser may have crashed since launch — relaunch once.
        await this.resetBrowser()
        try {
          return await this.renderWithSharedBrowser(htmlDocument)
        } catch {
          // Client gets the generic 503; the ORIGINAL failure travels as
          // `cause` and is logged by the global error handler.
          throw new ServiceUnavailableError(PDF_UNAVAILABLE_MESSAGE, { cause: firstError })
        }
      }
    } finally {
      this.releaseSlot()
    }
  }

  async dispose(): Promise<void> {
    await this.resetBrowser()
  }

  private async renderWithSharedBrowser(htmlDocument: string): Promise<Buffer> {
    const browser = await this.getBrowser()
    const context = await browser.newContext()

    try {
      const page = await context.newPage()
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
      await context.close()
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browserPromise === null) {
      this.browserPromise = (async () => {
        const { chromium } = await import('playwright')
        return chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        })
      })()
    }
    return this.browserPromise
  }

  private async resetBrowser(): Promise<void> {
    const pending = this.browserPromise
    this.browserPromise = null
    if (pending !== null) {
      try {
        const browser = await pending
        await browser.close()
      } catch {
        // Already dead — nothing to close.
      }
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeRenders < MAX_CONCURRENT_RENDERS) {
      this.activeRenders += 1
      return
    }
    await new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
    this.activeRenders += 1
  }

  private releaseSlot(): void {
    this.activeRenders -= 1
    const next = this.waiting.shift()
    if (next !== undefined) {
      next()
    }
  }
}
