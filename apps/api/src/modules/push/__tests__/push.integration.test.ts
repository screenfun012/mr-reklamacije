import { schema } from '@mr/db'
import { PushSubscriptionMode, type Permission } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { buildTestContainer, createPushTestApp, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const OFFICE = [
  'emotive_claims.view',
  'domace_claims.view',
] as const satisfies readonly Permission[]
/** The portal client. Not a key to anything internal — and a phone is internal. */
const CLIENT = ['emotive_claims.view_own_customer'] as const satisfies readonly Permission[]

const OTHER_USER_ID = '00000000-0000-4000-8000-0000000000fe'

describe('Push subscriptions', () => {
  let ctx: TestDbContext
  let container: Container
  let app: ReturnType<typeof createPushTestApp>

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
    await ensureTestUser(ctx.db, OTHER_USER_ID)
    app = createPushTestApp(container, testUser([...OFFICE]))
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  const subscribe = (target: ReturnType<typeof createPushTestApp>, endpoint: string) =>
    target.request('/api/push/devices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'iPad' },
      body: JSON.stringify({ endpoint, keys: { p256dh: 'kljuc', auth: 'tajna' } }),
    })

  it('refuses a portal client at the door', async () => {
    const portal = createPushTestApp(container, testUser([...CLIENT], TEST_USER_ID, ['client']))

    const res = await subscribe(portal, 'https://push.example/klijent')

    // ⚠ 403 at the door, not a row the fan-out would then have to remember to skip.
    expect(res.status).toBe(403)
  })

  it('records the device, and remembers what it is for the person to recognise', async () => {
    const res = await subscribe(app, 'https://push.example/a')
    expect(res.status).toBe(204)

    const devices = await container.pushRepository.listForUser(TEST_USER_ID)
    expect(devices).toHaveLength(1)
    expect(devices[0]?.userAgent).toBe('iPad')
    expect(devices[0]?.mode).toBe(PushSubscriptionMode.All)
  })

  /**
   * The one that matters.
   *
   * The same browser on the same device hands back the same endpoint every time. If a second person
   * signs in on the shop's tablet, the subscription has to be TAKEN OVER — two rows would leave the
   * previous user receiving the shop's messages on a device that is no longer theirs, and nothing
   * on the phone would ever reveal it.
   */
  it('hands the tablet over to whoever signed in on it', async () => {
    const endpoint = 'https://push.example/deljeni-tablet'
    await subscribe(app, endpoint)

    const second = createPushTestApp(container, testUser([...OFFICE], OTHER_USER_ID))
    await subscribe(second, endpoint)

    const rows = await ctx.db
      .select({ userId: schema.pushSubscriptions.userId })
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, endpoint))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(OTHER_USER_ID)
    expect(await container.pushRepository.listForUser(TEST_USER_ID)).toHaveLength(0)
  })

  it('moves the switch for the person, not for one device', async () => {
    await subscribe(app, 'https://push.example/telefon')
    await subscribe(app, 'https://push.example/racunar')

    const res = await app.request('/api/push/mode', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: PushSubscriptionMode.NoText }),
    })
    expect(res.status).toBe(204)

    const devices = await container.pushRepository.listForUser(TEST_USER_ID)
    expect(devices.map((device) => device.mode)).toEqual([
      PushSubscriptionMode.NoText,
      PushSubscriptionMode.NoText,
    ])
  })

  it('refuses a switch position nobody declared', async () => {
    const res = await app.request('/api/push/mode', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'tiho' }),
    })

    expect(res.status).toBe(400)
  })

  it('drops the caller own device, and never somebody another', async () => {
    await subscribe(app, 'https://push.example/moj')
    const [mine] = await container.pushRepository.listForUser(TEST_USER_ID)

    const stranger = createPushTestApp(container, testUser([...OFFICE], OTHER_USER_ID))
    const refused = await stranger.request(`/api/push/devices/${mine?.id ?? ''}`, {
      method: 'DELETE',
    })
    // Scoped to the caller: somebody else's id simply finds nothing to delete.
    expect(refused.status).toBe(204)
    expect(await container.pushRepository.listForUser(TEST_USER_ID)).toHaveLength(1)

    await app.request(`/api/push/devices/${mine?.id ?? ''}`, { method: 'DELETE' })
    expect(await container.pushRepository.listForUser(TEST_USER_ID)).toHaveLength(0)
  })

  it('says push is unavailable when the keys are absent, rather than offering a dead button', async () => {
    const res = await app.request('/api/push/public-key')

    // The test container carries no VAPID keys, and that IS the answer the screen needs.
    expect(await res.json()).toEqual({ publicKey: null })
  })
})
