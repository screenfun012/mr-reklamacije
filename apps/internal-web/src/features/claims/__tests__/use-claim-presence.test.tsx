import { ClaimKind } from '@mr/shared'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const heartbeat = vi.fn()
const leave = vi.fn()

vi.mock('@mr/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mr/shared')>()
  return {
    ...actual,
    sendPresenceHeartbeat: (...args: unknown[]) => heartbeat(...args),
    sendPresenceLeave: (...args: unknown[]) => leave(...args),
  }
})

import { useClaimPresence } from '../use-claim-presence'

describe('useClaimPresence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    heartbeat.mockReset().mockResolvedValue({ viewers: [] })
    leave.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('beats immediately and reports the other viewers', async () => {
    heartbeat.mockResolvedValueOnce({ viewers: [{ userId: 'b', name: 'Boban' }] })

    const { result } = renderHook(() => useClaimPresence(ClaimKind.Emotive, 'claim-1'))

    expect(heartbeat).toHaveBeenCalledWith({ kind: ClaimKind.Emotive, id: 'claim-1' })
    // Let the resolved heartbeat promise flush its state update under fake timers.
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current).toEqual([{ userId: 'b', name: 'Boban' }])
  })

  it('keeps beating on the interval', async () => {
    renderHook(() => useClaimPresence(ClaimKind.Emotive, 'claim-1'))
    expect(heartbeat).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(heartbeat).toHaveBeenCalledTimes(2)
  })

  it('leaves and stops beating on unmount', async () => {
    const { unmount } = renderHook(() => useClaimPresence(ClaimKind.Emotive, 'claim-1'))
    expect(heartbeat).toHaveBeenCalledTimes(1)

    unmount()
    expect(leave).toHaveBeenCalledWith({ kind: ClaimKind.Emotive, id: 'claim-1' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    // No further heartbeats after unmount.
    expect(heartbeat).toHaveBeenCalledTimes(1)
  })

  it("drops the previous claim's viewers the instant the claim changes", async () => {
    // A ⌘K jump reuses the component instance, so stale viewers must not linger
    // on the new claim until its first heartbeat answers.
    heartbeat.mockResolvedValueOnce({ viewers: [{ userId: 'b', name: 'Boban' }] })

    const { result, rerender } = renderHook(({ id }) => useClaimPresence(ClaimKind.Emotive, id), {
      initialProps: { id: 'claim-1' },
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current).toEqual([{ userId: 'b', name: 'Boban' }])

    // Next claim's heartbeat hasn't answered yet — the bar must already be empty.
    let releaseSecond: (value: { viewers: never[] }) => void = () => undefined
    heartbeat.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseSecond = resolve
      }),
    )
    rerender({ id: 'claim-2' })
    expect(result.current).toEqual([])

    await act(async () => {
      releaseSecond({ viewers: [] })
      await Promise.resolve()
    })
    expect(result.current).toEqual([])
  })

  it('re-targets when the claim changes', async () => {
    const { rerender } = renderHook(({ id }) => useClaimPresence(ClaimKind.Emotive, id), {
      initialProps: { id: 'claim-1' },
    })
    expect(heartbeat).toHaveBeenLastCalledWith({ kind: ClaimKind.Emotive, id: 'claim-1' })

    rerender({ id: 'claim-2' })
    // The old claim is left, the new one is beaten.
    expect(leave).toHaveBeenCalledWith({ kind: ClaimKind.Emotive, id: 'claim-1' })
    expect(heartbeat).toHaveBeenLastCalledWith({ kind: ClaimKind.Emotive, id: 'claim-2' })
  })

  it('stops beating while the tab is hidden and picks up again when it returns', async () => {
    const { unmount } = renderHook(() => useClaimPresence(ClaimKind.Emotive, 'claim-1'))
    expect(heartbeat).toHaveBeenCalledTimes(1)

    // Hidden: leave once, then no beat for as long as it stays hidden. Every beat costs a
    // session validation on the API, and a parked background tab must not pay it.
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(leave).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(heartbeat).toHaveBeenCalledTimes(1)

    hidden.mockReturnValue(false)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(heartbeat).toHaveBeenCalledTimes(2)

    hidden.mockRestore()
    unmount()
  })
})
