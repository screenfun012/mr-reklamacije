import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import { AppSettingsUpdateSchema } from './app-settings.validators.js'

export function createAppSettingsController(container: Container) {
  return {
    list: async (c: Context) => {
      const values = await container.appSettingsService.getOverrides()
      return c.json({ values })
    },

    update: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const body: unknown = await c.req.json()
      const input = AppSettingsUpdateSchema.parse(body)
      const values = await container.appSettingsService.update(input, getActorContext(c, user))
      return c.json({ values })
    },
  }
}
