import { assertIntegrationDatabase, createPool, getIntegrationDatabaseUrl } from '@mr/db'
import {
  ResourceChangedKey,
  ResourceEventType,
  SYSTEM_ROLE_OPERATOR,
  type AppEvent,
} from '@mr/shared'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fakeLogger } from '../../../test-helpers/test-app.js'
import { PostgresEventBus } from '../postgres-event-bus.js'

/** Resolves with the first event a listener receives, rejects if none arrives in time. */
function waitForEvent(timeoutMs = 2000): {
  promise: Promise<AppEvent>
  listener: (event: AppEvent) => void
} {
  let resolve: (event: AppEvent) => void
  const promise = new Promise<AppEvent>((res, reject) => {
    resolve = res
    setTimeout(() => reject(new Error(`waitForEvent: no event within ${timeoutMs}ms`)), timeoutMs)
  })
  return { promise, listener: (event) => resolve(event) }
}

describe('PostgresEventBus (real Postgres LISTEN/NOTIFY)', () => {
  const url = getIntegrationDatabaseUrl()
  assertIntegrationDatabase(url)

  let pool: pg.Pool
  let a: PostgresEventBus
  let b: PostgresEventBus

  beforeAll(async () => {
    pool = createPool(url)
    a = new PostgresEventBus(pool, url, fakeLogger())
    b = new PostgresEventBus(pool, url, fakeLogger())
    await a.start()
    await b.start()
  })

  afterAll(async () => {
    await a.dispose()
    await b.dispose()
    await pool.end()
  })

  it('delivers a publish from instance A to a subscriber on instance B (cross-instance) and to a subscriber on A itself (loopback)', async () => {
    const onB = waitForEvent()
    const onA = waitForEvent()
    const unsubB = b.subscribeUser('u1', [SYSTEM_ROLE_OPERATOR], onB.listener)
    const unsubA = a.subscribeUser('u2', [SYSTEM_ROLE_OPERATOR], onA.listener)

    try {
      a.publishResourceChanged(ResourceChangedKey.EngineTypes)

      const expected = {
        type: ResourceEventType.Changed,
        payload: { resource: ResourceChangedKey.EngineTypes },
      }
      await expect(onB.promise).resolves.toEqual(expected)
      await expect(onA.promise).resolves.toEqual(expected)
    } finally {
      unsubB()
      unsubA()
    }
  })

  it('ignores malformed NOTIFY payloads and keeps delivering valid events afterwards', async () => {
    const onB = waitForEvent()
    const unsubB = b.subscribeUser('u3', [SYSTEM_ROLE_OPERATOR], onB.listener)

    try {
      await expect(pool.query("SELECT pg_notify('mr_events', 'not json')")).resolves.toBeDefined()
      await expect(
        pool.query('SELECT pg_notify(\'mr_events\', \'{"kind":"unknownKind"}\')'),
      ).resolves.toBeDefined()

      a.publishResourceChanged(ResourceChangedKey.EngineManufacturers)

      await expect(onB.promise).resolves.toEqual({
        type: ResourceEventType.Changed,
        payload: { resource: ResourceChangedKey.EngineManufacturers },
      })
    } finally {
      unsubB()
    }
  })
})
