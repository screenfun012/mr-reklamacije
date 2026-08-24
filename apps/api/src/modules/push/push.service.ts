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

/** The push service's own way of saying "this browser is gone" (RFC 8030). */
const GONE_STATUS = new Set([404, 410])

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
    this.isEnabled =
      publicKey !== undefined &&
      publicKey !== '' &&
      privateKey !== undefined &&
      privateKey !== '' &&
      subject !== undefined &&
      subject !== ''

    if (this.isEnabled) {
      webpush.setVapidDetails(subject as string, publicKey as string, privateKey as string)
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
