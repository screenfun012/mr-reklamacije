import { describe, expect, it } from 'vitest'

import { ClaimPresenceStore } from '../presence.store.js'

/** A controllable clock so the TTL is tested by moving time, not by waiting. */
function clockStore(staleMs = 40_000) {
  let now = 1_000_000
  const store = new ClaimPresenceStore(() => now, staleMs)
  return { store, advance: (ms: number) => (now += ms) }
}

describe('ClaimPresenceStore', () => {
  it('returns everyone present on a claim, including the caller', () => {
    const { store } = clockStore()

    store.heartbeat('emotive:1', { userId: 'a', name: 'Ana' })
    const viewers = store.heartbeat('emotive:1', { userId: 'b', name: 'Boban' })

    expect(viewers).toHaveLength(2)
    expect(viewers.map((v) => v.userId).sort()).toEqual(['a', 'b'])
  })

  it('keeps claims separate — a viewer on one is not on another', () => {
    const { store } = clockStore()

    store.heartbeat('emotive:1', { userId: 'a', name: 'Ana' })
    store.heartbeat('domace:9', { userId: 'b', name: 'Boban' })

    expect(store.viewers('emotive:1').map((v) => v.userId)).toEqual(['a'])
    expect(store.viewers('domace:9').map((v) => v.userId)).toEqual(['b'])
  })

  it('refreshes a viewer instead of duplicating them, and updates the name', () => {
    const { store, advance } = clockStore()

    store.heartbeat('emotive:1', { userId: 'a', name: 'Ana' })
    advance(10_000)
    const viewers = store.heartbeat('emotive:1', { userId: 'a', name: 'Ana Anić' })

    expect(viewers).toHaveLength(1)
    expect(viewers[0]?.name).toBe('Ana Anić')
  })

  it('drops a viewer whose heartbeat went silent past the stale window', () => {
    const { store, advance } = clockStore(40_000)

    store.heartbeat('emotive:1', { userId: 'a', name: 'Ana' })
    store.heartbeat('emotive:1', { userId: 'b', name: 'Boban' })

    // Ana keeps beating; Boban went quiet (closed the laptop).
    advance(30_000)
    store.heartbeat('emotive:1', { userId: 'a', name: 'Ana' })
    advance(15_000) // Boban now 45s silent, past the 40s window; Ana 15s ago.

    const viewers = store.viewers('emotive:1')
    expect(viewers.map((v) => v.userId)).toEqual(['a'])
  })

  it('removes a viewer immediately on an explicit leave', () => {
    const { store } = clockStore()

    store.heartbeat('emotive:1', { userId: 'a', name: 'Ana' })
    store.heartbeat('emotive:1', { userId: 'b', name: 'Boban' })
    store.leave('emotive:1', 'a')

    expect(store.viewers('emotive:1').map((v) => v.userId)).toEqual(['b'])
  })

  it('reports an empty list for a claim nobody is viewing', () => {
    const { store } = clockStore()
    expect(store.viewers('emotive:404')).toEqual([])
  })

  it('is a no-op when leaving a claim you were never on', () => {
    const { store } = clockStore()
    expect(() => store.leave('emotive:1', 'ghost')).not.toThrow()
    expect(store.viewers('emotive:1')).toEqual([])
  })
})
