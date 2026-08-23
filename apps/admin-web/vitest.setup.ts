import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Radix Select/Popover rely on pointer capture APIs missing in jsdom.
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => undefined
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => undefined
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined
}

// cmdk relies on ResizeObserver, absent in jsdom.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}

// @testing-library's default async window is 1000 ms, and that default assumes a machine like this
// laptop. CI is a 2-core runner with several vitest workers on it, where the same work takes several
// times longer — measured: an assertion that costs 707 ms here blew the 1000 ms window there and
// reported an empty document, which reads as a broken screen rather than a slow one. A test that is
// genuinely stuck still fails, on vitest's own testTimeout (15 s).
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  cleanup()
})
