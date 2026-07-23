import type { Context } from 'hono'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import {
  NotificationIdParamSchema,
  NotificationListQuerySchema,
  NotificationSnoozeInputSchema,
} from './notifications.validators.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

export function createNotificationsController(container: Container) {
  return {
    list: async (c: Context) => {
      const user = requireUser(c)
      const query = NotificationListQuerySchema.parse(c.req.query())
      return c.json(await container.notificationsService.list(user.id, query))
    },

    markRead: async (c: Context) => {
      const user = requireUser(c)
      const { id } = NotificationIdParamSchema.parse({ id: c.req.param('id') })
      await container.notificationsService.markRead(user.id, id)
      return c.body(null, 204)
    },

    markAllRead: async (c: Context) => {
      const user = requireUser(c)
      await container.notificationsService.markAllRead(user.id)
      return c.body(null, 204)
    },

    delete: async (c: Context) => {
      const user = requireUser(c)
      const { id } = NotificationIdParamSchema.parse({ id: c.req.param('id') })
      await container.notificationsService.delete(user.id, id)
      return c.body(null, 204)
    },

    deleteAll: async (c: Context) => {
      const user = requireUser(c)
      await container.notificationsService.deleteAll(user.id)
      return c.body(null, 204)
    },

    snooze: async (c: Context) => {
      const user = requireUser(c)
      const { id } = NotificationIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const { until } = NotificationSnoozeInputSchema.parse(body)
      await container.notificationsService.snooze(user.id, id, until)
      return c.body(null, 204)
    },
  }
}
