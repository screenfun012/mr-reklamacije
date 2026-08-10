import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useConsumePrintFlag } from '../use-consume-print-flag.js'

describe('useConsumePrintFlag', () => {
  it('opens the preview when the wizard sent the order over to be printed', () => {
    // Without this the worker lands on a screen with four tabs and no idea that a paper is owed to
    // the customer standing beside him (`docs/25` §3.0).
    const onOpen = vi.fn()
    const onClear = vi.fn()

    renderHook(() => useConsumePrintFlag({ stampa: true, onOpen, onClear }))

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('clears the flag out of the address, so a reload does not print it again', () => {
    // Left in place, every reload — and every Back into this screen — reopens the preview over an
    // order handed over an hour ago.
    const onClear = vi.fn()

    renderHook(() => useConsumePrintFlag({ stampa: true, onOpen: vi.fn(), onClear }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('does nothing on an ordinary visit to the order', () => {
    const onOpen = vi.fn()
    const onClear = vi.fn()

    renderHook(() => useConsumePrintFlag({ stampa: undefined, onOpen, onClear }))

    expect(onOpen).not.toHaveBeenCalled()
    expect(onClear).not.toHaveBeenCalled()
  })

  it('acts once, however many times the route re-renders', () => {
    const onOpen = vi.fn()

    const { rerender } = renderHook(() =>
      useConsumePrintFlag({ stampa: true, onOpen, onClear: vi.fn() }),
    )
    rerender()
    rerender()

    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
