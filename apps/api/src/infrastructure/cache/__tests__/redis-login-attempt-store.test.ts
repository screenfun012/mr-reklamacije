import type { Redis } from 'ioredis'
import { describe, expect, it } from 'vitest'

import { createRedisLoginAttemptStore } from '../redis-login-attempt-store.js'

/**
 * Map-backed fake of the commands the store uses (eval for recordFailure, pttl,
 * del), with TTL tracking so a lock reports remaining time. Transcribes the
 * recordFailure Lua: INCR fail (TTL on first), SET lock once count >= max.
 */
function fakeRedis(): Redis {
  const store = new Map<string, { value: string; expireAt: number | null }>()
  const alive = (key: string) => {
    const entry = store.get(key)
    if (entry === undefined) return undefined
    if (entry.expireAt !== null && entry.expireAt <= Date.now()) {
      store.delete(key)
      return undefined
    }
    return entry
  }
  return {
    async pttl(key: string) {
      const entry = alive(key)
      if (entry === undefined) return -2
      return entry.expireAt === null ? -1 : entry.expireAt - Date.now()
    },
    async del(...keys: string[]) {
      let removed = 0
      for (const key of keys) {
        if (store.delete(key)) removed += 1
      }
      return removed
    },
    async eval(
      _script: string,
      _numKeys: number,
      failKey: string,
      lockKey: string,
      windowMs: string,
      lockoutMs: string,
      maxFailures: string,
    ) {
      const current = alive(failKey)
      const count = (current ? Number(current.value) : 0) + 1
      store.set(failKey, {
        value: String(count),
        expireAt: count === 1 ? Date.now() + Number(windowMs) : (current?.expireAt ?? null),
      })
      if (count >= Number(maxFailures)) {
        store.set(lockKey, { value: '1', expireAt: Date.now() + Number(lockoutMs) })
      }
      return count
    },
  } as unknown as Redis
}

describe('createRedisLoginAttemptStore', () => {
  it('locks after 5 failures and reports remaining seconds; success clears it', async () => {
    const store = createRedisLoginAttemptStore(fakeRedis(), 'test')

    for (let i = 0; i < 4; i += 1) {
      await store.recordFailure('user@example.com')
      expect(await store.checkLocked('user@example.com')).toBeNull()
    }
    await store.recordFailure('user@example.com')

    const remaining = await store.checkLocked('user@example.com')
    expect(remaining).not.toBeNull()
    expect(remaining ?? 0).toBeGreaterThan(0)

    await store.recordSuccess('user@example.com')
    expect(await store.checkLocked('user@example.com')).toBeNull()
  })

  it('keys case-insensitively (same account, different spelling)', async () => {
    const store = createRedisLoginAttemptStore(fakeRedis(), 'test')
    for (let i = 0; i < 5; i += 1) {
      await store.recordFailure('  Mix@Ed.com ')
    }
    expect(await store.checkLocked('mix@ed.com')).not.toBeNull()
  })

  it('falls back to the in-memory store when Redis errors (still locks, never breaks login)', async () => {
    const boom = {
      async pttl() {
        throw new Error('redis down')
      },
      async del() {
        throw new Error('redis down')
      },
      async eval() {
        throw new Error('redis down')
      },
    } as unknown as Redis
    const store = createRedisLoginAttemptStore(boom, 'test')

    for (let i = 0; i < 5; i += 1) {
      await store.recordFailure('c@d.com')
    }
    expect(await store.checkLocked('c@d.com')).not.toBeNull()
  })
})
