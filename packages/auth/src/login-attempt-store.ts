export const LOGIN_MAX_FAILURES = 5
export const LOGIN_LOCKOUT_MS = 15 * 60_000
/** Failures are counted within a rolling window before they decay. */
export const LOGIN_WINDOW_MS = 15 * 60_000

interface AttemptEntry {
  failures: number
  firstFailureAt: number
  lockedUntil: number | null
}

/**
 * Per-account (email-keyed) login lockout state. The interface is deliberately
 * storage-agnostic AND async: the in-memory implementation below is correct for a
 * single API instance, while a Redis-backed implementation of the same interface
 * (apps/api) is the swap that makes the lockout shared across replicas. Callers
 * await every method so either backing store slots in without a code change.
 */
export interface LoginAttemptStore {
  /** Seconds remaining while the account is locked, or null when it can attempt. */
  checkLocked(email: string): Promise<number | null>
  /** Count one failed password attempt; may transition the account to locked. */
  recordFailure(email: string): Promise<void>
  /** A successful login clears the account's failure state. */
  recordSuccess(email: string): Promise<void>
}

/** Order-independent, case/whitespace-insensitive account key (shared by every store). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * In-memory login-attempt store. Mirrors the fixed-window rate-limiter pattern
 * (Map + periodic cleanup). State is per-instance and resets on restart — an
 * accepted tradeoff for a single-instance deployment (an attacker cannot trigger
 * restarts), and the fallback the Redis store degrades to during a Redis outage.
 */
export function createLoginAttemptStore(): LoginAttemptStore {
  const entries = new Map<string, AttemptEntry>()

  const cleanup = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of entries) {
      const expiresAt = entry.lockedUntil ?? entry.firstFailureAt + LOGIN_WINDOW_MS
      if (expiresAt <= now) {
        entries.delete(key)
      }
    }
  }, LOGIN_WINDOW_MS)
  cleanup.unref()

  return {
    async checkLocked(email: string): Promise<number | null> {
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

    async recordFailure(email: string): Promise<void> {
      const key = normalizeEmail(email)
      const now = Date.now()
      const entry = entries.get(key)

      // Fresh account, or the previous window/lock has fully elapsed → start over.
      if (entry === undefined || now - entry.firstFailureAt > LOGIN_WINDOW_MS) {
        entries.set(key, { failures: 1, firstFailureAt: now, lockedUntil: null })
        return
      }

      entry.failures += 1
      if (entry.failures >= LOGIN_MAX_FAILURES) {
        entry.lockedUntil = now + LOGIN_LOCKOUT_MS
      }
    },

    async recordSuccess(email: string): Promise<void> {
      entries.delete(normalizeEmail(email))
    },
  }
}
