import type { Browser } from 'playwright'

import { ServiceUnavailableError } from '../../core/errors/domain-errors.js'
import { getClaimReportExportFontFaceCss } from './claim-report-export-font.js'
import { wrapClaimReportExportHtml } from './claim-report-export-styles.js'
import { Semaphore } from './render-semaphore.js'

const PDF_UNAVAILABLE_MESSAGE =
  'PDF izvoz trenutno nije dostupan. Koristite štampu iz pregleda izveštaja.'

// A Chromium instance costs ~1–3 s launch + hundreds of MB RSS. One shared
// browser (new context per render) removes the launch from every request; the
// slot cap keeps N concurrent exports from stacking N render pipelines.
const MAX_CONCURRENT_RENDERS = 2

/**
 * How long a browser with nothing to render is allowed to sit around.
 *
 * Keeping it alive forever traded a one-off ~1–3 s launch for ~600 MB of RSS
 * held until the next deploy — and memory is the dominant line on the hosting
 * bill. Exports are occasional, so an idle browser is pure cost: let it go and
 * pay the launch again on the next one.
 */
const IDLE_SHUTDOWN_MS = 10 * 60_000

/**
 * Renders claim-report HTML to PDF on a SHARED Chromium instance, capped at
 * MAX_CONCURRENT_RENDERS at a time. Construct once (DI container) and dispose
 * on shutdown. If the browser process dies, the next render relaunches it.
 * A browser left idle for IDLE_SHUTDOWN_MS closes itself.
 */
export class ClaimReportPdfRenderer {
  private browserPromise: Promise<Browser> | null = null
  private readonly slots = new Semaphore(MAX_CONCURRENT_RENDERS)
  private activeRenders = 0
  private idleTimer: NodeJS.Timeout | null = null

  async render(bodyHtml: string): Promise<Buffer> {
    const fontFaceCss = await getClaimReportExportFontFaceCss()
    const htmlDocument = wrapClaimReportExportHtml(bodyHtml, fontFaceCss)

    // Counted BEFORE queueing for a slot: a render waiting behind another one
    // must still hold the browser open.
    this.activeRenders += 1
    this.clearIdleTimer()

    await this.slots.acquire()
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
      this.slots.release()
      this.activeRenders -= 1
      this.scheduleIdleShutdown()
    }
  }

  async dispose(): Promise<void> {
    this.clearIdleTimer()
    await this.resetBrowser()
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private scheduleIdleShutdown(): void {
    if (this.activeRenders > 0) {
      return
    }

    this.clearIdleTimer()
    const timer = setTimeout(() => {
      this.idleTimer = null
      if (this.activeRenders > 0) {
        return
      }
      // Fire-and-forget: a browser that refuses to close is already gone as far
      // as the next render is concerned (resetBrowser swallows and relaunches).
      void this.resetBrowser()
    }, IDLE_SHUTDOWN_MS)
    // Never hold the process open just to close a browser later.
    timer.unref()
    this.idleTimer = timer
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
}
