import type { Browser } from 'playwright'

import { ServiceUnavailableError } from '../errors/domain-errors.js'
import { Semaphore } from './render-semaphore.js'

const PDF_UNAVAILABLE_MESSAGE = 'Iscrtavanje PDF dokumenta trenutno nije dostupno.'

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
 * What the caller decides about the page itself. Deliberately a subset of Playwright's options,
 * because these are the ones the documents disagree about: the claim report is A4 with millimetre
 * margins, the intake work order is its own pixel-exact box with none, and the handover record is
 * the only one that paginates.
 */
export interface PdfPageOptions {
  readonly format?: 'A4'
  readonly printBackground: boolean
  /** Makes the document's own `@page` rule the single source of the page size. */
  readonly preferCSSPageSize?: boolean
  readonly margin?: { top: string; right: string; bottom: string; left: string }
  /**
   * The three below exist for the one document that runs to several pages: without a page number a
   * lost page is invisible, and a sheet cannot number itself because it cannot count its own pages.
   * Chromium draws these INSIDE the page margins, so they push no content — measured 2026-08-14 on
   * the handover record: identical content boxes, 5.1 KB larger.
   *
   * `displayHeaderFooter` turns BOTH on at once, so a caller that wants only a footer must pass an
   * empty `headerTemplate` — otherwise Chromium stamps its own default date-and-title header.
   */
  readonly displayHeaderFooter?: boolean
  readonly headerTemplate?: string
  readonly footerTemplate?: string
}

/**
 * Renders a COMPLETE HTML document to PDF on a SHARED Chromium instance, capped at
 * MAX_CONCURRENT_RENDERS at a time. Construct once (DI container) and dispose
 * on shutdown. If the browser process dies, the next render relaunches it.
 * A browser left idle for IDLE_SHUTDOWN_MS closes itself.
 *
 * It knows nothing about what it is drawing: fonts, styles and page size arrive inside the document
 * it is handed. That is what lets one browser serve both the claim report and the intake work order
 * — and it is also why it lives in `core/` rather than beside either of them, since a module may not
 * import a sibling module.
 */
export class PdfRenderer {
  private browserPromise: Promise<Browser> | null = null
  private readonly slots = new Semaphore(MAX_CONCURRENT_RENDERS)
  private activeRenders = 0
  private idleTimer: NodeJS.Timeout | null = null

  async renderDocument(htmlDocument: string, options: PdfPageOptions): Promise<Buffer> {
    // Counted BEFORE queueing for a slot: a render waiting behind another one
    // must still hold the browser open.
    this.activeRenders += 1
    this.clearIdleTimer()

    await this.slots.acquire()
    try {
      try {
        return await this.renderWithSharedBrowser(htmlDocument, options)
      } catch (firstError) {
        // The shared browser may have crashed since launch — relaunch once.
        await this.resetBrowser()
        try {
          return await this.renderWithSharedBrowser(htmlDocument, options)
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

  private async renderWithSharedBrowser(
    htmlDocument: string,
    options: PdfPageOptions,
  ): Promise<Buffer> {
    const browser = await this.getBrowser()
    const context = await browser.newContext()

    try {
      const page = await context.newPage()
      await page.setContent(htmlDocument, { waitUntil: 'load' })
      await page.waitForFunction('document.fonts.ready')
      const pdf = await page.pdf({ displayHeaderFooter: false, ...options })

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
