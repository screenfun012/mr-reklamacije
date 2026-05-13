import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RolesPermissionSource } from '../server/permission-cache.js'
import {
  createCachedPermissionResolver,
  getPermissionCacheEntryCount,
} from '../server/permission-cache.js'

describe('createCachedPermissionResolver', () => {
  let resolveForRoles: ReturnType<typeof vi.fn>
  let cached: ReturnType<typeof createCachedPermissionResolver>

  beforeEach(() => {
    resolveForRoles = vi.fn(async (roles: readonly string[]) =>
      roles.some((r) => r === 'admin') ? ['*'] : ['claims.read'],
    )
    const source = { resolveForRoles } satisfies RolesPermissionSource
    cached = createCachedPermissionResolver(source)
    cached.clearCache()
  })

  it('calls underlying resolver on cache miss', async () => {
    await cached.resolveForRoles(['operator'])
    expect(resolveForRoles).toHaveBeenCalledTimes(1)
  })

  it('returns cached value on second call', async () => {
    await cached.resolveForRoles(['operator'])
    await cached.resolveForRoles(['operator'])
    expect(resolveForRoles).toHaveBeenCalledTimes(1)
  })

  it('uses sorted role list as cache key', async () => {
    await cached.resolveForRoles(['admin', 'operator'])
    await cached.resolveForRoles(['operator', 'admin'])
    expect(resolveForRoles).toHaveBeenCalledTimes(1)
    expect(getPermissionCacheEntryCount()).toBe(1)
  })

  it('different role sets create different cache entries', async () => {
    await cached.resolveForRoles(['admin'])
    await cached.resolveForRoles(['operator'])
    expect(resolveForRoles).toHaveBeenCalledTimes(2)
    expect(getPermissionCacheEntryCount()).toBe(2)
  })

  it('expires cache after TTL', async () => {
    vi.useFakeTimers()
    try {
      await cached.resolveForRoles(['operator'])
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000)
      await cached.resolveForRoles(['operator'])
      expect(resolveForRoles).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
      cached.clearCache()
    }
  })

  it('clearCache forces fresh fetch', async () => {
    await cached.resolveForRoles(['operator'])
    cached.clearCache()
    await cached.resolveForRoles(['operator'])
    expect(resolveForRoles).toHaveBeenCalledTimes(2)
  })
})
