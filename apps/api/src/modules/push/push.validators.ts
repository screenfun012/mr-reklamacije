import { pushSubscriptionModeValues } from '@mr/shared'
import { z } from 'zod'

/**
 * What the browser hands back from `PushManager.subscribe`.
 *
 * ⚠ `endpoint` is only checked for being a URL, never parsed: it is an opaque address chosen by
 * whichever push service the browser uses, and reading anything out of it would be reading someone
 * else's implementation detail.
 */
export const PushSubscribeInputSchema = z.object({
  endpoint: z.string().url().max(2048),
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
