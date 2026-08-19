import { describe, expect, it } from 'vitest'

import { SummaryCache } from '../../../infrastructure/cache/summary-cache.js'
import type { RedisCache } from '../../../infrastructure/cache/redis-cache.js'
import { DashboardService } from '../dashboard.service.js'
import type { DashboardRepository } from '../dashboard.repository.js'
import type { AppSettingsReader } from '../../../core/settings/app-settings.reader.js'
import type { DashboardActor } from '../dashboard.types.js'

/**
 * An ENABLED cache, which the integration suite does not have: with no Redis, `SummaryCache.read`
 * runs `compute()` and never touches a key — so an integration test cannot tell a correct cache key
 * from a broken one. Dropping `employees.view_analytics` out of that key left all 23 integration
 * tests green, and it is the one mistake here that would hand one reader's names to another.
 */
function enabledCache(): RedisCache {
  const store = new Map<string, unknown>()
  return {
    enabled: true,
    getNumber: async () => Promise.resolve(0),
    get: async <T>(key: string) => Promise.resolve((store.get(key) as T | undefined) ?? null),
    set: async (key: string, value: unknown) => {
      store.set(key, value)
      return Promise.resolve()
    },
  } as unknown as RedisCache
}

const WITHOUT: DashboardActor = { id: 'u1', permissions: ['emotive_claims.view'] }
const WITH: DashboardActor = {
  id: 'u2',
  permissions: ['emotive_claims.view', 'employees.view_analytics'],
}

function serviceReturning(): { service: DashboardService; calls: boolean[] } {
  const calls: boolean[] = []
  const repo = {
    getSummary: async (_scope: unknown, includeNamedBlame: boolean) => {
      calls.push(includeNamedBlame)
      return Promise.resolve({
        topFaultEmployees: includeNamedBlame
          ? [{ employeeId: 'e1', name: 'Pera', faultCount: 3 }]
          : null,
      })
    },
  } as unknown as DashboardRepository

  const service = new DashboardService(
    repo,
    new SummaryCache(enabledCache()),
    {} as unknown as AppSettingsReader,
  )

  return { service, calls }
}

describe('DashboardService summary cache', () => {
  it('does not serve named blame from an entry built for a reader who may not see it', async () => {
    const { service } = serviceReturning()

    const first = await service.getSummary(WITHOUT)
    const second = await service.getSummary(WITH)
    const third = await service.getSummary(WITHOUT)

    expect(first.topFaultEmployees).toBeNull()
    expect(second.topFaultEmployees).not.toBeNull()
    expect(third.topFaultEmployees).toBeNull()
  })

  it('still caches within one permission, so the gate costs one extra entry and not the cache', async () => {
    const { service, calls } = serviceReturning()

    await service.getSummary(WITH)
    await service.getSummary(WITH)

    expect(calls).toEqual([true])
  })
})
