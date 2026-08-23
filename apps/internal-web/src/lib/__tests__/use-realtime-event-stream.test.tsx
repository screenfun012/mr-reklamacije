import { SSE_PING_EVENT } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useRealtimeEventStream } from '../use-realtime-event-stream.js'

vi.mock('../auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u-1' } } }) },
}))

/** Every EventSource the hook opens, so a test can see a reconnect happen. */
const opened: FakeEventSource[] = []

class FakeEventSource {
  readonly listeners = new Map<string, Set<(event: unknown) => void>>()
  closed = false
  onerror: (() => void) | null = null

  constructor(readonly url: string) {
    opened.push(this)
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  close(): void {
    this.closed = true
  }

  emit(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

function Probe(): null {
  useRealtimeEventStream()
  return null
}

function mount(): () => void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  )
  return () => {
    view.unmount()
  }
}

describe('the realtime stream watchdog', () => {
  beforeEach(() => {
    opened.length = 0
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reopens the stream after 45 seconds of complete silence', () => {
    const unmount = mount()
    expect(opened).toHaveLength(1)

    // A half-open connection announces nothing: `onerror` never fires and EventSource believes it
    // is connected. Without this watchdog the chat sits there looking fine and saying nothing.
    vi.advanceTimersByTime(46_000)

    expect(opened[0]?.closed).toBe(true)
    expect(opened).toHaveLength(2)
    unmount()
  })

  it('stays open while the server keeps pinging', () => {
    const unmount = mount()

    for (let i = 0; i < 3; i += 1) {
      vi.advanceTimersByTime(20_000)
      opened[0]?.emit(SSE_PING_EVENT)
    }
    vi.advanceTimersByTime(20_000)

    // 80 s have passed but never 45 s of silence — one connection, never torn down.
    expect(opened).toHaveLength(1)
    expect(opened[0]?.closed).toBe(false)
    unmount()
  })

  it('stops watching once the screen is gone', () => {
    const unmount = mount()
    unmount()

    vi.advanceTimersByTime(120_000)

    expect(opened).toHaveLength(1)
  })
})
