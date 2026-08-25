import { PushSubscriptionMode } from '@mr/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createECDH } from 'node:crypto'

import type { Logger } from '@mr/logger'

import type { PushRepository, StoredPushSubscription } from '../push.repository.js'
import { PushService } from '../push.service.js'

// The push service itself is an external HTTP API — the one thing this repo's rules DO allow
// mocking. Everything below it (who gets told, and how much) is ours and is exercised for real.
const sendNotification = vi.fn()
const setVapidDetails = vi.fn()
vi.mock('web-push', () => ({
  default: {
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
  },
}))

function vapidPair(privateLastByte: number): { publicKey: string; privateKey: string } {
  const privateKey = Buffer.alloc(32)
  privateKey[31] = privateLastByte
  const curve = createECDH('prime256v1')
  curve.setPrivateKey(privateKey)
  return {
    publicKey: curve.getPublicKey().toString('base64url'),
    privateKey: privateKey.toString('base64url'),
  }
}

const KEYS = { ...vapidPair(1), subject: 'mailto:a@b.c' }

const ANA = '11111111-1111-4111-8111-111111111111'
const BRANKO = '22222222-2222-4222-8222-222222222222'

function subscription(over: Partial<StoredPushSubscription> = {}): StoredPushSubscription {
  return {
    id: crypto.randomUUID(),
    userId: ANA,
    sessionId: crypto.randomUUID(),
    endpoint: `https://push.example/${crypto.randomUUID()}`,
    p256dh: 'kljuc',
    auth: 'tajna',
    mode: PushSubscriptionMode.All,
    ...over,
  }
}

function message(over: Partial<Parameters<PushService['notifyChatMessage']>[0]> = {}) {
  return {
    conversationId: '33333333-3333-4333-8333-333333333333',
    conversationTitle: '7167/25',
    authorName: 'Slavko Jović',
    excerpt: 'stigao motor',
    mentionedUserIds: [] as string[],
    recipientIds: [ANA],
    ...over,
  }
}

function build(subscriptions: StoredPushSubscription[], keys = KEYS) {
  const removeIfMatches = vi.fn(async () => {})
  const repo = {
    listForUsers: vi.fn(async () => subscriptions),
    removeIfMatches,
  } as unknown as PushRepository
  const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() } as unknown as Logger
  return { service: new PushService(repo, logger, keys), removeIfMatches, logger }
}

describe('who a new chat message reaches', () => {
  beforeEach(() => {
    sendNotification.mockReset()
    sendNotification.mockResolvedValue(undefined)
    setVapidDetails.mockReset()
    // Back to a working configuration: the two cases below deliberately make it throw.
    setVapidDetails.mockImplementation(() => undefined)
  })

  it('says nothing at all when the keys are absent', async () => {
    const { service } = build([subscription()], { publicKey: '', privateKey: '', subject: '' })

    expect(service.isEnabled).toBe(false)
    // ⚠ And does not throw: an unconfigured push is a disabled feature, not a broken one.
    await expect(service.notifyChatMessage(message())).resolves.toBeUndefined()
    expect(sendNotification).not.toHaveBeenCalled()
  })

  /**
   * The regression for a production outage on 2026-08-24.
   *
   * `VAPID_SUBJECT` was entered as `someone@example.com` instead of `mailto:someone@example.com`.
   * `setVapidDetails` threw inside the container's constructor, `server.js` never started, and the
   * WHOLE API crash-looped — claims, intake, the portal, all of it — because of one optional
   * variable for a feature nobody had turned on yet.
   *
   * ⚠ An optional feature that can refuse to start the service it lives in is not optional.
   */
  it('goes quiet on a bad configuration instead of taking the API down with it', () => {
    setVapidDetails.mockImplementation(() => {
      throw new Error('Vapid subject is not a valid URL. someone@example.com')
    })

    const { service, logger } = build([subscription()], {
      ...KEYS,
      // The exact mistake: an email address rather than a mailto: URL.
      subject: 'someone@example.com',
    })

    expect(service.isEnabled).toBe(false)
    // And says so loudly enough to be found in the logs, naming what the value must look like.
    expect(logger.error).toHaveBeenCalled()
  })

  it('sends nothing at all once it has gone quiet', async () => {
    setVapidDetails.mockImplementation(() => {
      throw new Error('Vapid subject is not a valid URL. someone@example.com')
    })

    const { service } = build([subscription()], {
      ...KEYS,
      subject: 'someone@example.com',
    })

    await expect(service.notifyChatMessage(message())).resolves.toBeUndefined()
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('goes quiet when valid-looking VAPID keys are not one pair', () => {
    const { service, logger } = build([subscription()], {
      publicKey: KEYS.publicKey,
      privateKey: vapidPair(2).privateKey,
      subject: KEYS.subject,
    })

    expect(service.isEnabled).toBe(false)
    expect(logger.error).toHaveBeenCalled()
    expect(setVapidDetails).not.toHaveBeenCalled()
  })

  it('sends the author and the room, with the first words', async () => {
    const { service } = build([subscription()])

    await service.notifyChatMessage(message())

    const [, payload] = sendNotification.mock.calls[0] as [unknown, string]
    expect(JSON.parse(payload)).toEqual({
      title: 'Slavko Jović · 7167/25',
      body: 'stigao motor',
      conversationId: '33333333-3333-4333-8333-333333333333',
      recipientId: ANA,
    })
  })

  it('holds the words back in the „bez teksta" position', async () => {
    const { service } = build([subscription({ mode: PushSubscriptionMode.NoText })])

    await service.notifyChatMessage(message())

    const [, payload] = sendNotification.mock.calls[0] as [unknown, string]
    // ⚠ The words never leave the server — not hidden on the phone, not sent. That is the whole
    // point of the position: a phone on a workbench says a room has something new and no more.
    expect(JSON.parse(payload)).toEqual({
      title: '7167/25',
      body: '',
      conversationId: '33333333-3333-4333-8333-333333333333',
      recipientId: ANA,
    })
  })

  it('stays quiet in „samo pomeni" until it is a mention', async () => {
    const { service } = build([subscription({ mode: PushSubscriptionMode.Mentions })])

    await service.notifyChatMessage(message())
    expect(sendNotification).not.toHaveBeenCalled()

    await service.notifyChatMessage(message({ mentionedUserIds: [ANA] }))
    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it('reads the switch of the person the device belongs to, not of the room', async () => {
    const { service } = build([
      subscription({ userId: ANA, mode: PushSubscriptionMode.Mentions }),
      subscription({ userId: BRANKO, mode: PushSubscriptionMode.All }),
    ])

    await service.notifyChatMessage(message({ recipientIds: [ANA, BRANKO] }))

    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it('sends independently to every device of one recipient', async () => {
    const { service } = build([subscription(), subscription()])

    await service.notifyChatMessage(message())

    expect(sendNotification).toHaveBeenCalledTimes(2)
  })

  it('keeps no more than ten sends in flight', async () => {
    let active = 0
    let peak = 0
    sendNotification.mockImplementation(async () => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
    })
    const { service } = build(Array.from({ length: 11 }, () => subscription()))

    await service.notifyChatMessage(message())

    expect(peak).toBeLessThanOrEqual(10)
  })

  it('keeps no more than ten sends in flight across simultaneous messages', async () => {
    let active = 0
    let peak = 0
    sendNotification.mockImplementation(async () => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
    })
    const { service } = build(Array.from({ length: 10 }, () => subscription()))

    await Promise.all([service.notifyChatMessage(message()), service.notifyChatMessage(message())])

    expect(sendNotification).toHaveBeenCalledTimes(20)
    expect(peak).toBeLessThanOrEqual(10)
  })

  it('bounds the pending transport queue during a burst', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    sendNotification.mockImplementation(() => gate)
    // 49 other people × the defensive five-device cap: one ordinary 50-person room must fit.
    // Twelve such messages at once must not turn into 2,940 retained future HTTPS attempts.
    const { service, logger } = build(Array.from({ length: 245 }, () => subscription()))

    const burst = Array.from({ length: 12 }, () => service.notifyChatMessage(message()))
    await vi.waitFor(() => expect(sendNotification).toHaveBeenCalledTimes(10))
    expect(sendNotification).toHaveBeenCalledTimes(10)

    release()
    await Promise.all(burst)
    // Ten active + 250 pending cover one worst-case normal fan-out; every newer target fails fast.
    expect(sendNotification).toHaveBeenCalledTimes(260)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: expect.objectContaining({ backpressure: expect.any(Number) }),
      }),
      'chat push delivery failures',
    )
  })

  it('always sets a short TTL and a topic, so a phone off overnight is not buried', async () => {
    const { service } = build([subscription()])

    await service.notifyChatMessage(message())

    const [, , options] = sendNotification.mock.calls[0] as [
      unknown,
      string,
      Record<string, unknown>,
    ]
    // Four weeks is web-push's own default and it would deliver all of yesterday on reconnect.
    expect(options['TTL']).toBe(3600)
    // A socket the push service accepts and then ignores is held for two hours without this.
    expect(options['timeout']).toBe(5000)
    // RFC 8030 §5.4, capped at 32 base64url characters — a uuid without dashes is exactly 32.
    expect(options['topic']).toBe('33333333333343338333333333333333')
    expect(String(options['topic'])).toHaveLength(32)
    /*
     * ⚠ Not decoration, and not the library's default: unsaid, web-push sends `normal`, which
     * under RFC 8030 is the level a push service MAY hold back to spare the battery. Android's
     * Doze does exactly that, and the whole held stretch then lands at once when the app is
     * opened — Nikola's report of 2026-08-25.
     */
    expect(options['urgency']).toBe('high')
  })

  it('deletes only the exact browser row the push service says is gone', async () => {
    const dead = subscription()
    const { service, removeIfMatches } = build([dead])
    sendNotification.mockRejectedValue({ statusCode: 410 })

    await service.notifyChatMessage(message())

    // ⚠ Not merely logged: a row nobody deletes is a request this service pays for on every single
    // message, forever.
    expect(removeIfMatches).toHaveBeenCalledWith(dead)
  })

  /**
   * The day the VAPID keys are rotated, EVERY existing subscription answers 403 — its signature was
   * made with a key that no longer exists. Treating that as temporary would leave the whole table
   * dead forever, each row paying for a request that cannot succeed, while the screen went on
   * saying notifications were working.
   */
  it('drops a subscription signed by a key that no longer exists', async () => {
    const stale = subscription()
    const { service, removeIfMatches } = build([stale])
    sendNotification.mockRejectedValue({ statusCode: 403 })

    await service.notifyChatMessage(message())

    expect(removeIfMatches).toHaveBeenCalledWith(stale)
  })

  it('drops a subscription when the push service reports invalid VAPID authorization as 401', async () => {
    const stale = subscription()
    const { service, removeIfMatches } = build([stale])
    sendNotification.mockRejectedValue({ statusCode: 401 })

    await service.notifyChatMessage(message())

    expect(removeIfMatches).toHaveBeenCalledWith(stale)
  })

  it('keeps a browser that merely had a bad minute', async () => {
    const alive = subscription()
    const { service, removeIfMatches } = build([alive])
    sendNotification.mockRejectedValue({ statusCode: 503 })

    await service.notifyChatMessage(message())

    expect(removeIfMatches).not.toHaveBeenCalled()
  })

  it.each([429, 503])('retries one explicit transient %i once', async (statusCode) => {
    const { service } = build([subscription()])
    sendNotification.mockRejectedValueOnce({ statusCode }).mockResolvedValueOnce(undefined)

    await service.notifyChatMessage(message())

    expect(sendNotification).toHaveBeenCalledTimes(2)
  })

  it('stops after one retry for a transient push response', async () => {
    const { service } = build([subscription()])
    sendNotification.mockRejectedValue({ statusCode: 503 })

    await service.notifyChatMessage(message())

    expect(sendNotification).toHaveBeenCalledTimes(2)
  })

  it('does not retry an ambiguous network error', async () => {
    const { service } = build([subscription()])
    sendNotification.mockRejectedValue(new Error('mreža'))

    await service.notifyChatMessage(message())

    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it('does not retry a nonterminal client error', async () => {
    const { service } = build([subscription()])
    sendNotification.mockRejectedValue({ statusCode: 400 })

    await service.notifyChatMessage(message())

    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it('never rejects, whatever the transport does', async () => {
    const { service } = build([subscription()])
    sendNotification.mockRejectedValue(new Error('mreža'))

    // Node 24 throws on an unhandled rejection and this API registers no handler — a push service
    // having a bad day must not be able to take the whole thing down.
    await expect(service.notifyChatMessage(message())).resolves.toBeUndefined()
  })
})
