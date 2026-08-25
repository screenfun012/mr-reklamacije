import type { Logger } from '@mr/logger'
import { PushSubscriptionMode, type PushSubscriptionMode as Mode } from '@mr/shared'
import webpush from 'web-push'
import { createECDH, timingSafeEqual } from 'node:crypto'

import type { ChatPushMessage, PushPort } from '../../core/ports/push-port.js'

import type { PushRepository, StoredPushSubscription } from './push.repository.js'

/**
 * How long a push service keeps an undelivered message.
 *
 * ⚠ `web-push` defaults this to FOUR WEEKS (`DEFAULT_TTL = 2419200`). A phone that was off
 * overnight would wake to the whole of yesterday's chat, message by message. An hour is roughly
 * how long a line in a workshop conversation is worth reading.
 */
const PUSH_TTL_SECONDS = 3600

/**
 * ⚠ `web-push` sets no socket timeout, and neither does Node's `https.request`. A push service that
 * accepts the connection and then goes quiet holds the socket until TCP keepalive gives up — two
 * hours on Linux defaults. That is exactly the shape of the memory step this API has been bitten by
 * before, and memory is 86% of the hosting bill.
 */
const PUSH_TIMEOUT_MS = 5000
const PUSH_CONCURRENCY = 10
// One worst-case 50-person room (author + 49 recipients × five devices) fits; a concurrent burst
// cannot retain an unbounded tail of future HTTPS work.
const PUSH_MAX_PENDING_SENDS = 250
const PUSH_BACKPRESSURE = new Error('push transport queue is full')

type SendFailure = number | 'network' | 'backpressure'

/**
 * The answers that mean "this subscription will never work again".
 *
 * 404 and 410 are the push service saying the browser is gone. ⚠ 401/403 can say the VAPID
 * authorization does not match the key the subscription was made with — which is what EVERY row
 * looks like the day the keys are rotated. Without those, rotation kills push silently for
 * everybody and leaves the dead rows behind forever, each one paying for a request that cannot
 * succeed. With them, the table cleans itself and the browser silently creates/rebinds a valid row
 * on its next app load.
 */
const GONE_STATUS = new Set([401, 403, 404, 410])

/**
 * Telling phones about a new chat message.
 *
 * ⚠ Whether somebody SHOULD be told is decided by the chat module, which knows what a conversation
 * is and who muted it. This decides only whether their switch wants this particular message, and
 * how much of it to say.
 */
export class PushService implements PushPort {
  readonly isEnabled: boolean
  private readonly transportLimiter = new ConcurrencyLimiter(
    PUSH_CONCURRENCY,
    PUSH_MAX_PENDING_SENDS,
  )

  constructor(
    private readonly repo: PushRepository,
    private readonly logger: Logger,
    keys: {
      publicKey?: string | undefined
      privateKey?: string | undefined
      subject?: string | undefined
    },
  ) {
    const { publicKey, privateKey, subject } = keys
    const configured =
      publicKey !== undefined &&
      publicKey !== '' &&
      privateKey !== undefined &&
      privateKey !== '' &&
      subject !== undefined &&
      subject !== ''

    if (!configured) {
      this.isEnabled = false
      return
    }

    /*
     * ⚠ A wrong value here disables PUSH. It must never take the API down with it.
     *
     * `setVapidDetails` throws on anything it does not like — and on 2026-08-24 it did: a subject
     * entered as `someone@example.com` instead of `mailto:someone@example.com` threw inside the
     * container's constructor, so `server.js` never started and the WHOLE API crash-looped in
     * production. Claims, intake, the portal — all of it down, because of one optional variable for
     * a feature nobody had turned on yet.
     *
     * An optional feature that can refuse to start the service it lives in is not optional. So the
     * failure is caught, named loudly enough to be found in the logs, and push alone goes quiet.
     */
    try {
      if (!vapidKeysMatch(publicKey, privateKey)) {
        throw new Error('VAPID public and private keys are not one pair')
      }
      webpush.setVapidDetails(subject, publicKey, privateKey)
      this.isEnabled = true
    } catch (error) {
      this.isEnabled = false
      this.logger.error(
        { err: error, subject },
        'Push is disabled: the VAPID configuration was refused. VAPID_SUBJECT must be a URL — ' +
          'either "mailto:someone@example.com" or "https://example.com" — and the keys must be the ' +
          'pair printed by `npx web-push generate-vapid-keys`.',
      )
    }
  }

  async notifyChatMessage(message: ChatPushMessage): Promise<void> {
    if (!this.isEnabled || message.recipientIds.length === 0) {
      return
    }

    const mentioned = new Set(message.mentionedUserIds)
    const subscriptions = await this.repo.listForUsers(message.recipientIds)

    const targets = subscriptions.filter((subscription) =>
      wants(subscription.mode, mentioned.has(subscription.userId)),
    )
    const failures: SendFailure[] = []

    // Submit the whole fan-out now. The limiter accepts only its hard active+pending capacity;
    // batching here would hide future batches outside that counter and make the queue unbounded.
    const outcomes = await Promise.all(
      targets.map((subscription) => this.send(subscription, message)),
    )
    failures.push(...outcomes.flatMap((outcome) => (outcome === null ? [] : [outcome])))

    if (failures.length > 0) {
      this.logger.error(
        {
          attempted: targets.length,
          failed: failures.length,
          statuses: failures.reduce<Record<string, number>>((counts, status) => {
            const key = String(status)
            counts[key] = (counts[key] ?? 0) + 1
            return counts
          }, {}),
        },
        'chat push delivery failures',
      )
    }
  }

  private async send(
    subscription: StoredPushSubscription,
    message: ChatPushMessage,
  ): Promise<SendFailure | null> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transportLimiter.run(() =>
          webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(bodyFor(subscription.mode, message, subscription.userId)),
            {
              TTL: PUSH_TTL_SECONDS,
              /*
               * ⚠ `high`, and the library sends `normal` when nothing is said.
               *
               * Under RFC 8030 `normal` is the level at which a push service MAY hold a message back
               * for the device's battery, and Android's Doze does exactly that: the phone stays quiet
               * for as long as it is asleep, and then the whole stretch arrives at once the moment the
               * app is opened. That is what Nikola saw on 2026-08-25 — a first notification, then
               * nothing, then all of them together. `high` asks for delivery now, which is what a
               * message in a workshop is worth.
               */
              urgency: 'high',
              timeout: PUSH_TIMEOUT_MS,
              // ⚠ RFC 8030 §5.4: this collapses messages still QUEUED at the push service, which `tag`
              // cannot do — `tag` only replaces what has already reached the device. Capped at 32
              // base64url characters, which a uuid without its dashes is exactly.
              topic: message.conversationId.replaceAll('-', ''),
            },
          ),
        )
        return null
      } catch (error) {
        if (error === PUSH_BACKPRESSURE) {
          return 'backpressure'
        }
        const status = (error as { statusCode?: number }).statusCode
        if (status !== undefined && GONE_STATUS.has(status)) {
          // ⚠ Not a failure to log and forget: the browser is gone for good, and a row nobody deletes
          // is a request this service pays for on every single message, forever.
          try {
            await this.repo.removeIfMatches(subscription)
          } catch {
            return status
          }
          return null
        }
        if (attempt === 0 && isRetryable(status)) {
          continue
        }
        return status ?? 'network'
      }
    }

    return null
  }
}

function vapidKeysMatch(publicKey: string, privateKey: string): boolean {
  const curve = createECDH('prime256v1')
  curve.setPrivateKey(Buffer.from(privateKey, 'base64url'))
  const expected = curve.getPublicKey()
  const actual = Buffer.from(publicKey, 'base64url')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function isRetryable(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500 && status <= 599)
}

/** Bounds external HTTP across every chat send handled by this API process. */
class ConcurrencyLimiter {
  private active = 0
  private readonly waiters: Array<() => void> = []

  constructor(
    private readonly limit: number,
    private readonly maxWaiters: number,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await work()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1
      return Promise.resolve()
    }

    if (this.waiters.length >= this.maxWaiters) {
      return Promise.reject(PUSH_BACKPRESSURE)
    }
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  private release(): void {
    const next = this.waiters.shift()
    if (next !== undefined) {
      next()
      return
    }
    this.active -= 1
  }
}

/** Does this person's switch want to hear about this particular message? */
function wants(mode: Mode, isMentioned: boolean): boolean {
  return mode === PushSubscriptionMode.Mentions ? isMentioned : true
}

/**
 * What the phone actually shows.
 *
 * ⚠ In `no_text` the words do not leave the server at all — not hidden on the phone, not sent. That
 * is the whole point of the position: a phone on a workbench says a room has something new, and
 * what it says stays behind the lock screen.
 */
function bodyFor(
  mode: Mode,
  message: ChatPushMessage,
  recipientId: string,
): { title: string; body: string; conversationId: string; recipientId: string } {
  if (mode === PushSubscriptionMode.NoText) {
    return {
      title: message.conversationTitle,
      body: '',
      conversationId: message.conversationId,
      recipientId,
    }
  }

  return {
    title: `${message.authorName} · ${message.conversationTitle}`,
    body: message.excerpt,
    conversationId: message.conversationId,
    recipientId,
  }
}
