import type { Context } from 'hono'

import { getActorContext } from '../../core/http/actor-context.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { Container } from '../../core/container.js'
import {
  ExternalPartyCreateInputSchema,
  ReferenceListQuerySchema,
} from './external-parties.validators.js'

export function createExternalPartiesController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = ReferenceListQuerySchema.parse(c.req.query())
      const result = await container.externalPartiesService.list(query)
      return c.json(result)
    },

    create: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const body: unknown = await c.req.json()
      const input = ExternalPartyCreateInputSchema.parse(body)
      const created = await container.externalPartiesService.create(input, getActorContext(c, user))
      return c.json(created, 201)
    },
  }
}
