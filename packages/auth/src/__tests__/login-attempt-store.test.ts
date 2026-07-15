import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLoginAttemptStore } from '../login-attempt-store.js'

const LOCKOUT_MS = 15 * 60_000

describe('createLoginAttemptStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('locks the account after 5 failures and reports remaining seconds', () => {
    const store = createLoginAttemptStore()
    for (let i = 0; i < 4; i += 1) {
      store.recordFailure('user@example.com')
      expect(store.checkLocked('user@example.com')).toBeNull()
    }
    store.recordFailure('user@example.com')

    const remaining = store.checkLocked('user@example.com')
    expect(remaining).not.toBeNull()
    expect(remaining ?? 0).toBeGreaterThan(0)
    expect(remaining ?? 0).toBeLessThanOrEqual(LOCKOUT_MS / 1000)
  })

  it('keys case-insensitively and trims whitespace', () => {
    const store = createLoginAttemptStore()
    for (let i = 0; i < 5; i += 1) {
      store.recordFailure('  Mix@Ed.com ')
    }
    expect(store.checkLocked('mix@ed.com')).not.toBeNull()
  })

  it('clears the lock on a successful login', () => {
    const store = createLoginAttemptStore()
    for (let i = 0; i < 5; i += 1) {
      store.recordFailure('a@b.com')
    }
    expect(store.checkLocked('a@b.com')).not.toBeNull()

    store.recordSuccess('a@b.com')
    expect(store.checkLocked('a@b.com')).toBeNull()
  })

  it('expires the lock after the lockout window', () => {
    const store = createLoginAttemptStore()
    for (let i = 0; i < 5; i += 1) {
      store.recordFailure('a@b.com')
    }
    expect(store.checkLocked('a@b.com')).not.toBeNull()

    vi.advanceTimersByTime(LOCKOUT_MS + 1_000)
    expect(store.checkLocked('a@b.com')).toBeNull()
  })

  it('keeps accounts independent — locking one never affects another (no shared-IP collateral)', () => {
    const store = createLoginAttemptStore()
    for (let i = 0; i < 5; i += 1) {
      store.recordFailure('victim@b.com')
    }
    expect(store.checkLocked('victim@b.com')).not.toBeNull()

    // The whole point of per-account keying: a different account is untouched.
    expect(store.checkLocked('colleague@b.com')).toBeNull()
    store.recordFailure('colleague@b.com')
    expect(store.checkLocked('colleague@b.com')).toBeNull()
  })

  it('decays failures across the counting window (5 slow failures do not lock)', () => {
    const store = createLoginAttemptStore()
    for (let i = 0; i < 5; i += 1) {
      store.recordFailure('slow@b.com')
      vi.advanceTimersByTime(20 * 60_000)
    }
    expect(store.checkLocked('slow@b.com')).toBeNull()
  })
})
