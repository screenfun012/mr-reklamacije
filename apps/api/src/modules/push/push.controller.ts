import type { Context } from 'hono'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'

import {
  PushModeInputSchema,
  PushSubscribeInputSchema,
  PushSubscriptionIdParamSchema,
} from './push.validators.js'

function actor(c: Context): { userId: string; sessionId: string } {
  const user: MRSessionUser | null = c.get('user')
  const session = c.get('session')
  if (user === null || session === null) {
    throw new UnauthorizedError()
  }
  return { userId: user.id, sessionId: session.id }
}

export function createPushController(container: Container): {
  publicKey: (c: Context) => Promise<Response>
  listDevices: (c: Context) => Promise<Response>
  subscribe: (c: Context) => Promise<Response>
  setMode: (c: Context) => Promise<Response>
  removeDevice: (c: Context) => Promise<Response>
} {
  return {
    /**
     * The key the browser needs to subscribe at all.
     *
     * ⚠ Also the honest answer to "is push available here": when it is absent the screen must not
     * offer a button, because `PushManager.subscribe` cannot be called without it.
     */
    publicKey: async (c: Context) => {
      actor(c)
      /*
       * ⚠ `isEnabled`, not merely "a key is set".
       *
       * That is exactly how production failed on 2026-08-24: the keys were there and VAPID_SUBJECT
       * was malformed, so the service refused the configuration — but the screen would still have
       * offered the button, everybody would have turned it on, rows would have piled up in
       * `push_subscriptions`, and not one notification would ever have been sent. The only trace in
       * the world was a single line in the startup log.
       */
      const publicKey = container.pushService.isEnabled
        ? (container.env.VAPID_PUBLIC_KEY ?? null)
        : null
      return c.json({ publicKey })
    },

    listDevices: async (c: Context) => {
      const current = actor(c)
      const devices = await container.pushRepository.listForUser(current.userId, current.sessionId)
      return c.json({
        items: devices.map((device) => ({
          id: device.id,
          userAgent: device.userAgent,
          mode: device.mode,
          createdAt: device.createdAt.toISOString(),
          isCurrent: device.isCurrent,
        })),
        total: devices.length,
        page: 1,
        pageSize: devices.length,
      })
    },

    subscribe: async (c: Context) => {
      const input = PushSubscribeInputSchema.parse(await c.req.json())
      const current = actor(c)
      await container.pushRepository.subscribe({
        userId: current.userId,
        sessionId: current.sessionId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        // Only so a person can tell their own devices apart in the list — never matched on.
        userAgent: c.req.header('user-agent') ?? null,
      })
      return c.body(null, 204)
    },

    setMode: async (c: Context) => {
      const { mode } = PushModeInputSchema.parse(await c.req.json())
      // Per PERSON, not per device (Nikola, 2026-08-23) — so it lands on every row they have.
      await container.pushRepository.setMode(actor(c).userId, mode)
      return c.body(null, 204)
    },

    removeDevice: async (c: Context) => {
      const { id } = PushSubscriptionIdParamSchema.parse({ id: c.req.param('id') })
      // Scoped to the caller: somebody else's device id simply finds nothing.
      const current = actor(c)
      await container.pushRepository.removeForSession(current.userId, current.sessionId, id)
      return c.body(null, 204)
    },
  }
}
