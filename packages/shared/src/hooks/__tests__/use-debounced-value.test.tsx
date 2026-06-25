/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedValue } from '../use-debounced-value.js'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('alpha', 300))
    expect(result.current).toBe('alpha')
  })

  it('updates after the delay when the value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'alpha', delayMs: 300 } },
    )

    rerender({ value: 'beta', delayMs: 300 })
    expect(result.current).toBe('alpha')

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('alpha')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('beta')
  })

  it('resets the timer when the value changes again before the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'alpha' },
    })

    rerender({ value: 'beta' })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    rerender({ value: 'gamma' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('alpha')

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('gamma')
  })
})
