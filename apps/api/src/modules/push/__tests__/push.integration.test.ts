import { schema } from '@mr/db'
import { PushSubscriptionMode, type Permission } from '@mr/shared'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import {
  buildTestContainer,
  createPushTestApp,
  testSession,
  testUser,
} from '../../../test-helpers/test-app.js'
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
  let sessionId: string
  let otherSessionId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
    await ensureTestUser(ctx.db, OTHER_USER_ID)
    const [firstSession] = await ctx.db
      .insert(schema.sessions)
      .values({
        token: `push-test-${crypto.randomUUID()}`,
        userId: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning({ id: schema.sessions.id })
    const [secondSession] = await ctx.db
      .insert(schema.sessions)
      .values({
        token: `push-test-other-${crypto.randomUUID()}`,
        userId: OTHER_USER_ID,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning({ id: schema.sessions.id })
    if (firstSession === undefined || secondSession === undefined) {
      throw new Error('push test sessions were not created')
    }
    sessionId = firstSession.id
    otherSessionId = secondSession.id
    app = createPushTestApp(container, testUser([...OFFICE]), testSession(sessionId))
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
    const portal = createPushTestApp(
      container,
      testUser([...CLIENT], TEST_USER_ID, ['client']),
      testSession(sessionId),
    )

    const res = await subscribe(portal, 'https://fcm.googleapis.com/fcm/send/klijent')

    // ⚠ 403 at the door, not a row the fan-out would then have to remember to skip.
    expect(res.status).toBe(403)
  })

  /**
   * ⚠ An endpoint is a URL the server will POST to on somebody else's instruction.
   *
   * Left open, a signed-in person could point it at anything — including an address inside the
   * private network — and the API would dutifully make the request. The world's browsers have four
   * push services between them, so the allowlist is short and costs nothing.
   */
  it('refuses an endpoint that is not a push service at all', async () => {
    const res = await subscribe(app, 'https://example.com/collect')

    expect(res.status).toBe(400)
    expect(await container.pushRepository.listForUser(TEST_USER_ID, sessionId)).toHaveLength(0)
  })

  it('does not treat regex-like lookalike hosts as Google push', async () => {
    const res = await subscribe(app, 'https://fcmXgoogleapis.com/collect')

    expect(res.status).toBe(400)
  })

  it('refuses a plain http endpoint', async () => {
    const res = await subscribe(app, 'http://fcm.googleapis.com/fcm/send/abc')

    expect(res.status).toBe(400)
  })

  it('takes a real one', async () => {
    const res = await subscribe(app, 'https://fcm.googleapis.com/fcm/send/abc123')

    expect(res.status).toBe(204)
  })

  it('accepts Apple regional push subdomains without opening the allowlist', async () => {
    const res = await subscribe(app, 'https://web.push.apple.com/QH4o/example')

    expect(res.status).toBe(204)
  })

  it('records the device, and remembers what it is for the person to recognise', async () => {
    const res = await subscribe(app, 'https://fcm.googleapis.com/fcm/send/a')
    expect(res.status).toBe(204)

    const devices = await container.pushRepository.listForUser(TEST_USER_ID, sessionId)
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
    const endpoint = 'https://fcm.googleapis.com/fcm/send/deljeni-tablet'
    await subscribe(app, endpoint)

    const second = createPushTestApp(
      container,
      testUser([...OFFICE], OTHER_USER_ID),
      testSession(otherSessionId, OTHER_USER_ID),
    )
    await subscribe(second, endpoint)

    const rows = await ctx.db
      .select({ userId: schema.pushSubscriptions.userId })
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, endpoint))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(OTHER_USER_ID)
    expect(await container.pushRepository.listForUser(TEST_USER_ID, sessionId)).toHaveLength(0)
  })

  it('moves the switch for the person, not for one device', async () => {
    await subscribe(app, 'https://fcm.googleapis.com/fcm/send/telefon')
    const [secondSession] = await ctx.db
      .insert(schema.sessions)
      .values({
        token: `push-test-mode-${crypto.randomUUID()}`,
        userId: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning({ id: schema.sessions.id })
    if (secondSession === undefined) throw new Error('mode session was not created')
    const secondBrowser = createPushTestApp(
      container,
      testUser([...OFFICE]),
      testSession(secondSession.id),
    )
    await subscribe(secondBrowser, 'https://fcm.googleapis.com/fcm/send/racunar')

    const res = await app.request('/api/push/mode', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: PushSubscriptionMode.NoText }),
    })
    expect(res.status).toBe(204)

    const devices = await container.pushRepository.listForUser(TEST_USER_ID, sessionId)
    expect(devices.map((device) => device.mode)).toEqual([
      PushSubscriptionMode.NoText,
      PushSubscriptionMode.NoText,
    ])
    const [person] = await ctx.db
      .select({ pushMode: schema.users.pushMode })
      .from(schema.users)
      .where(eq(schema.users.id, TEST_USER_ID))
    expect(person?.pushMode).toBe(PushSubscriptionMode.NoText)
  })

  it('initialises a missing person mode from the most private legacy device', async () => {
    await ctx.db
      .update(schema.users)
      .set({ pushMode: null })
      .where(eq(schema.users.id, TEST_USER_ID))
    await ctx.db.insert(schema.pushSubscriptions).values([
      {
        userId: TEST_USER_ID,
        endpoint: 'https://fcm.googleapis.com/fcm/send/legacy-private',
        p256dh: 'kljuc',
        auth: 'tajna',
        mode: PushSubscriptionMode.NoText,
        createdAt: new Date(Date.now() - 1000),
      },
      {
        userId: TEST_USER_ID,
        endpoint: 'https://fcm.googleapis.com/fcm/send/legacy-newer-all',
        p256dh: 'kljuc',
        auth: 'tajna',
        mode: PushSubscriptionMode.All,
        createdAt: new Date(),
      },
    ])

    expect((await subscribe(app, 'https://fcm.googleapis.com/fcm/send/legacy-rebind')).status).toBe(
      204,
    )

    const [person] = await ctx.db
      .select({ pushMode: schema.users.pushMode })
      .from(schema.users)
      .where(eq(schema.users.id, TEST_USER_ID))
    expect(person?.pushMode).toBe(PushSubscriptionMode.NoText)
    expect((await container.pushRepository.listForUser(TEST_USER_ID, sessionId))[0]?.mode).toBe(
      PushSubscriptionMode.NoText,
    )
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
    await subscribe(app, 'https://fcm.googleapis.com/fcm/send/moj')
    const [mine] = await container.pushRepository.listForUser(TEST_USER_ID, sessionId)

    const stranger = createPushTestApp(
      container,
      testUser([...OFFICE], OTHER_USER_ID),
      testSession(otherSessionId, OTHER_USER_ID),
    )
    const refused = await stranger.request(`/api/push/devices/${mine?.id ?? ''}`, {
      method: 'DELETE',
    })
    // Scoped to the caller: somebody else's id simply finds nothing to delete.
    expect(refused.status).toBe(204)
    expect(await container.pushRepository.listForUser(TEST_USER_ID, sessionId)).toHaveLength(1)

    await app.request(`/api/push/devices/${mine?.id ?? ''}`, { method: 'DELETE' })
    expect(await container.pushRepository.listForUser(TEST_USER_ID, sessionId)).toHaveLength(0)
  })

  it('says push is unavailable when the keys are absent, rather than offering a dead button', async () => {
    const res = await app.request('/api/push/public-key')

    // The test container carries no VAPID keys, and that IS the answer the screen needs.
    expect(await res.json()).toEqual({ publicKey: null })
  })

  it('keeps only the latest endpoint for one browser session', async () => {
    await subscribe(app, 'https://fcm.googleapis.com/fcm/send/prvi')
    await subscribe(app, 'https://fcm.googleapis.com/fcm/send/drugi')

    const devices = await container.pushRepository.listForUser(TEST_USER_ID, sessionId)
    expect(devices).toHaveLength(1)
  })

  it('re-posts the same browser endpoint idempotently on an app load', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/isti'
    await subscribe(app, endpoint)
    const [before] = await container.pushRepository.listForUser(TEST_USER_ID, sessionId)

    const repeated = await subscribe(app, endpoint)
    const [after] = await container.pushRepository.listForUser(TEST_USER_ID, sessionId)

    expect(repeated.status).toBe(204)
    expect(after?.id).toBe(before?.id)
  })

  it('marks the caller current device and cannot remove a device from another session', async () => {
    await subscribe(app, 'https://fcm.googleapis.com/fcm/send/prvi-uredjaj')

    const [secondSession] = await ctx.db
      .insert(schema.sessions)
      .values({
        token: `push-test-second-${crypto.randomUUID()}`,
        userId: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning({ id: schema.sessions.id })
    if (secondSession === undefined) throw new Error('second session was not created')
    const otherBrowser = createPushTestApp(
      container,
      testUser([...OFFICE]),
      testSession(secondSession.id),
    )
    await subscribe(otherBrowser, 'https://fcm.googleapis.com/fcm/send/drugi-uredjaj')

    const listed = await app.request('/api/push/devices')
    const body = (await listed.json()) as {
      items: Array<{ id: string; isCurrent: boolean }>
    }
    expect(body.items.filter((device) => device.isCurrent)).toHaveLength(1)
    const remote = body.items.find((device) => !device.isCurrent)
    if (remote === undefined) throw new Error('remote device was not listed')

    await app.request(`/api/push/devices/${remote.id}`, { method: 'DELETE' })

    expect(await container.pushRepository.listForUser(TEST_USER_ID, sessionId)).toHaveLength(2)
  })

  it('gives an endpoint taken over by another account that account mode', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/zajednicki-rezim'
    await subscribe(app, endpoint)
    await app.request('/api/push/mode', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: PushSubscriptionMode.Mentions }),
    })

    const second = createPushTestApp(
      container,
      testUser([...OFFICE], OTHER_USER_ID),
      testSession(otherSessionId, OTHER_USER_ID),
    )
    await subscribe(second, 'https://fcm.googleapis.com/fcm/send/drugi-uredjaj-drugog')
    const [otherSecondSession] = await ctx.db
      .insert(schema.sessions)
      .values({
        token: `push-test-takeover-${crypto.randomUUID()}`,
        userId: OTHER_USER_ID,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning({ id: schema.sessions.id })
    if (otherSecondSession === undefined) throw new Error('takeover session was not created')
    const secondDevice = createPushTestApp(
      container,
      testUser([...OFFICE], OTHER_USER_ID),
      testSession(otherSecondSession.id, OTHER_USER_ID),
    )
    await subscribe(secondDevice, endpoint)

    const devices = await container.pushRepository.listForUser(OTHER_USER_ID, otherSessionId)
    expect(devices.map((device) => device.mode)).toEqual([
      PushSubscriptionMode.All,
      PushSubscriptionMode.All,
    ])
  })

  it('excludes a subscription whose session has expired', async () => {
    const [expired] = await ctx.db
      .insert(schema.sessions)
      .values({
        token: `push-test-expired-${crypto.randomUUID()}`,
        userId: TEST_USER_ID,
        expiresAt: new Date(Date.now() - 1000),
      })
      .returning({ id: schema.sessions.id })
    if (expired === undefined) throw new Error('expired session was not created')

    await ctx.db.execute(sql`
      INSERT INTO push_subscriptions (user_id, session_id, endpoint, p256dh, auth)
      VALUES (${TEST_USER_ID}, ${expired.id}, 'https://fcm.googleapis.com/fcm/send/istekao', 'kljuc', 'tajna')
    `)

    expect(await container.pushRepository.listForUsers([TEST_USER_ID])).toHaveLength(0)
  })

  it('stops a revoked session and preserves the person privacy mode for silent rebind', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/opozvan'
    await subscribe(app, endpoint)
    await app.request('/api/push/mode', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: PushSubscriptionMode.NoText }),
    })

    await ctx.db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId))
    expect(await container.pushRepository.listForUsers([TEST_USER_ID])).toHaveLength(0)

    const [nextSession] = await ctx.db
      .insert(schema.sessions)
      .values({
        token: `push-test-rebind-${crypto.randomUUID()}`,
        userId: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning({ id: schema.sessions.id })
    if (nextSession === undefined) throw new Error('rebind session was not created')
    const nextApp = createPushTestApp(container, testUser([...OFFICE]), testSession(nextSession.id))
    expect((await subscribe(nextApp, endpoint)).status).toBe(204)

    const rebound = await container.pushRepository.listForUser(TEST_USER_ID, nextSession.id)
    expect(rebound.map((device) => device.mode)).toEqual([PushSubscriptionMode.NoText])
  })

  it('defensively sends to no more than five active sessions per person', async () => {
    for (let index = 0; index < 6; index += 1) {
      const [activeSession] = await ctx.db
        .insert(schema.sessions)
        .values({
          token: `push-test-cap-${index}-${crypto.randomUUID()}`,
          userId: OTHER_USER_ID,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - index * 1000),
        })
        .returning({ id: schema.sessions.id })
      if (activeSession === undefined) throw new Error('cap session was not created')
      await ctx.db.insert(schema.pushSubscriptions).values({
        userId: OTHER_USER_ID,
        sessionId: activeSession.id,
        endpoint: `https://fcm.googleapis.com/fcm/send/cap-${index}`,
        p256dh: 'kljuc',
        auth: 'tajna',
      })
    }

    expect(await container.pushRepository.listForUsers([OTHER_USER_ID])).toHaveLength(5)
  })

  it('never sends through a session owned by a different account', async () => {
    await ctx.db.insert(schema.pushSubscriptions).values({
      userId: OTHER_USER_ID,
      sessionId,
      endpoint: 'https://fcm.googleapis.com/fcm/send/rolling-owner-mismatch',
      p256dh: 'kljuc',
      auth: 'tajna',
    })

    expect(await container.pushRepository.listForUsers([OTHER_USER_ID])).toHaveLength(0)
  })
})
