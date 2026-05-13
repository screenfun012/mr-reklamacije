type CacheEntry = {
  permissions: readonly string[]
  expiresAt: number
}

const TTL_MS = 5 * 60 * 1000

const cache = new Map<string, CacheEntry>()

export interface RolesPermissionSource {
  resolveForRoles(roleCodes: readonly string[]): Promise<readonly string[]>
}

/**
 * Wraps a permission resolver with in-memory TTL cache.
 * Cache key is sorted role codes joined with "|".
 *
 * Entries expire after 5 minutes — role_permission changes propagate within TTL
 * for all sessions whose role combinations share that cache key.
 */
export function createCachedPermissionResolver(
  source: RolesPermissionSource,
): RolesPermissionSource & { clearCache: () => void } {
  return {
    async resolveForRoles(roleCodes: readonly string[]): Promise<string[]> {
      const key = [...roleCodes].sort().join('|')
      const now = Date.now()

      const entry = cache.get(key)
      if (entry && entry.expiresAt > now) {
        return [...entry.permissions]
      }

      const resolved = await source.resolveForRoles(roleCodes)
      const permissions = [...resolved]
      cache.set(key, {
        permissions,
        expiresAt: now + TTL_MS,
      })
      return [...permissions]
    },

    clearCache(): void {
      cache.clear()
    },
  }
}

/**
 * Test-only helper to inspect cache state.
 */
export function getPermissionCacheEntryCount(): number {
  return cache.size
}
