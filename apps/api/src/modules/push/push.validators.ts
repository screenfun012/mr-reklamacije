import { pushSubscriptionModeValues } from '@mr/shared'
import { z } from 'zod'

/**
 * What the browser hands back from `PushManager.subscribe`.
 *
 * ⚠ `endpoint` is only checked for being a URL, never parsed: it is an opaque address chosen by
 * whichever push service the browser uses, and reading anything out of it would be reading someone
 * else's implementation detail.
 */
/**
 * The hosts real push services actually use.
 *
 * ⚠ Without this, `endpoint` is any URL at all — and the API then makes an outbound POST to
 * whatever a signed-in person put there. That is a request the server makes on somebody else's
 * instruction, which is the shape of an attack even when the person meant nothing by it. The list
 * is short because the world's browsers only have four of these between them.
 */
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  'wns2-.*\\.notify\\.windows\\.com',
  'notify\\.windows\\.com',
]

function isPushServiceUrl(value: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }

  // https only: a push endpoint is never anything else, and it keeps `http://` targets inside the
  // private network out of reach.
  if (parsed.protocol !== 'https:') {
    return false
  }

  return PUSH_SERVICE_HOSTS.some((host) => new RegExp(`^${host}$`).test(parsed.host))
}

export const PushSubscribeInputSchema = z.object({
  endpoint: z.string().url().max(2048).refine(isPushServiceUrl, 'Not a push service endpoint'),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
})

export type PushSubscribeInput = z.infer<typeof PushSubscribeInputSchema>

export const PushModeInputSchema = z.object({
  mode: z.enum(pushSubscriptionModeValues),
})

export const PushSubscriptionIdParamSchema = z.object({
  id: z.string().uuid(),
})
