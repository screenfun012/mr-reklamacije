import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PdfRenderer } from '../pdf-renderer.js'

const IDLE_SHUTDOWN_MS = 10 * 60_000

/** Irrelevant to what these cover — the browser's lifetime, not the page's shape. */
const PAGE = { printBackground: true } as const

const browserClose = vi.fn(async () => undefined)
const launch = vi.fn(async () => ({
  newContext: async () => ({
    newPage: async () => ({
      setContent: async () => undefined,
      waitForFunction: async () => undefined,
      pdf: async () => Buffer.from('%PDF-fake'),
    }),
    close: async () => undefined,
  }),
  close: browserClose,
}))

vi.mock('playwright', () => ({ chromium: { launch: () => launch() } }))

/**
 * The shared Chromium used to live until the next deploy, holding hundreds of
 * MB for hours after a single export. These cover the idle-shutdown contract.
 */
describe('PdfRenderer idle shutdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    launch.mockClear()
    browserClose.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('closes the browser once it has been idle for the full window', async () => {
    const renderer = new PdfRenderer()
    await renderer.renderDocument('<p>izveštaj</p>', PAGE)

    expect(browserClose).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(IDLE_SHUTDOWN_MS)

    expect(browserClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the browser alive before the window elapses', async () => {
    const renderer = new PdfRenderer()
    await renderer.renderDocument('<p>izveštaj</p>', PAGE)

    await vi.advanceTimersByTimeAsync(IDLE_SHUTDOWN_MS - 1_000)

    expect(browserClose).not.toHaveBeenCalled()
    await renderer.dispose()
  })

  it('a later render relaunches the browser and re-arms the timer', async () => {
    const renderer = new PdfRenderer()
    await renderer.renderDocument('<p>prvi</p>', PAGE)
    await vi.advanceTimersByTimeAsync(IDLE_SHUTDOWN_MS)
    expect(launch).toHaveBeenCalledTimes(1)

    await renderer.renderDocument('<p>drugi</p>', PAGE)
    expect(launch).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(IDLE_SHUTDOWN_MS)
    expect(browserClose).toHaveBeenCalledTimes(2)
  })

  it('a render that starts inside the idle window cancels the shutdown', async () => {
    const renderer = new PdfRenderer()
    await renderer.renderDocument('<p>prvi</p>', PAGE)

    await vi.advanceTimersByTimeAsync(IDLE_SHUTDOWN_MS - 1_000)
    await renderer.renderDocument('<p>drugi</p>', PAGE)
    // Past the ORIGINAL deadline — the second render must have re-armed it.
    await vi.advanceTimersByTimeAsync(2_000)

    expect(browserClose).not.toHaveBeenCalled()
    expect(launch).toHaveBeenCalledTimes(1)
    await renderer.dispose()
  })

  it('dispose cancels the pending timer so shutdown closes exactly once', async () => {
    const renderer = new PdfRenderer()
    await renderer.renderDocument('<p>izveštaj</p>', PAGE)

    await renderer.dispose()
    await vi.advanceTimersByTimeAsync(IDLE_SHUTDOWN_MS)

    expect(browserClose).toHaveBeenCalledTimes(1)
  })
})
