import type { Logger } from '@mr/logger'
import { PushSubscriptionMode, type PushSubscriptionMode as Mode } from '@mr/shared'
import webpush from 'web-push'

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

/**
 * The answers that mean "this subscription will never work again".
 *
 * 404 and 410 are the push service saying the browser is gone. ⚠ 403 is it saying the signature
 * does not match the key the subscription was made with — which is what EVERY row looks like the
 * day the VAPID keys are rotated. Without it, rotation kills push silently for everybody and leaves
 * the dead rows behind forever, each one paying for a request that cannot succeed. With it, the
 * table cleans itself and people simply turn notifications on again.
 */
const GONE_STATUS = new Set([403, 404, 410])

/**
 * Telling phones about a new chat message.
 *
 * ⚠ Whether somebody SHOULD be told is decided by the chat module, which knows what a conversation
 * is and who muted it. This decides only whether their switch wants this particular message, and
 * how much of it to say.
 */
export class PushService implements PushPort {
  readonly isEnabled: boolean

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

    await Promise.allSettled(
      subscriptions
        .filter((subscription) => wants(subscription.mode, mentioned.has(subscription.userId)))
        .map((subscription) => this.send(subscription, message)),
    )
  }

  private async send(
    subscription: StoredPushSubscription,
    message: ChatPushMessage,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(bodyFor(subscription.mode, message)),
        {
          TTL: PUSH_TTL_SECONDS,
          timeout: PUSH_TIMEOUT_MS,
          // ⚠ RFC 8030 §5.4: this collapses messages still QUEUED at the push service, which `tag`
          // cannot do — `tag` only replaces what has already reached the device. Capped at 32
          // base64url characters, which a uuid without its dashes is exactly.
          topic: message.conversationId.replaceAll('-', ''),
        },
      )
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status !== undefined && GONE_STATUS.has(status)) {
        // ⚠ Not a failure to log and forget: the browser is gone for good, and a row nobody deletes
        // is a request this service pays for on every single message, forever.
        await this.repo.removeByEndpoint(subscription.endpoint)
        return
      }
      this.logger.error({ err: error, status }, 'chat push failed')
    }
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
): { title: string; body: string; conversationId: string } {
  if (mode === PushSubscriptionMode.NoText) {
    return { title: message.conversationTitle, body: '', conversationId: message.conversationId }
  }

  return {
    title: `${message.authorName} · ${message.conversationTitle}`,
    body: message.excerpt,
    conversationId: message.conversationId,
  }
}
