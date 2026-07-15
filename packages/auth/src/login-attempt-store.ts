const MAX_FAILURES = 5
const LOCKOUT_MS = 15 * 60_000
/** Failures are counted within a rolling window before they decay. */
const WINDOW_MS = 15 * 60_000

interface AttemptEntry {
  failures: number
  firstFailureAt: number
  lockedUntil: number | null
}

/**
 * Per-account (email-keyed) login lockout state. The interface is deliberately
 * storage-agnostic: the in-memory implementation below is correct for a single
 * API instance (current deployment). A Redis/DB-backed implementation of the
 * same interface is the swap needed IF we ever run more than one API instance.
 */
export interface LoginAttemptStore {
  /** Seconds remaining while the account is locked, or null when it can attempt. */
  checkLocked(email: string): number | null
  /** Count one failed password attempt; may transition the account to locked. */
  recordFailure(email: string): void
  /** A successful login clears the account's failure state. */
  recordSuccess(email: string): void
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * In-memory login-attempt store. Mirrors the fixed-window rate-limiter pattern
 * (Map + periodic cleanup). State is per-instance and resets on restart — an
 * accepted tradeoff for a single-instance deployment (an attacker cannot trigger
 * restarts). Swap for a shared store when scaling to multiple API instances.
 */
export function createLoginAttemptStore(): LoginAttemptStore {
  const entries = new Map<string, AttemptEntry>()

  const cleanup = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of entries) {
      const expiresAt = entry.lockedUntil ?? entry.firstFailureAt + WINDOW_MS
      if (expiresAt <= now) {
        entries.delete(key)
      }
    }
  }, WINDOW_MS)
  cleanup.unref()

  return {
    checkLocked(email: string): number | null {
      const key = normalizeEmail(email)
      const entry = entries.get(key)
      if (entry === undefined || entry.lockedUntil === null) {
        return null
      }
      const remainingMs = entry.lockedUntil - Date.now()
      if (remainingMs <= 0) {
        entries.delete(key)
        return null
      }
      return Math.ceil(remainingMs / 1000)
    },

    recordFailure(email: string): void {
      const key = normalizeEmail(email)
      const now = Date.now()
      const entry = entries.get(key)

      // Fresh account, or the previous window/lock has fully elapsed → start over.
      if (entry === undefined || now - entry.firstFailureAt > WINDOW_MS) {
        entries.set(key, { failures: 1, firstFailureAt: now, lockedUntil: null })
        return
      }

      entry.failures += 1
      if (entry.failures >= MAX_FAILURES) {
        entry.lockedUntil = now + LOCKOUT_MS
      }
    },

    recordSuccess(email: string): void {
      entries.delete(normalizeEmail(email))
    },
  }
}
