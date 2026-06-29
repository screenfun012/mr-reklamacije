import type { Context } from 'hono'

import { getActorContext } from '../../core/http/actor-context.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { Container } from '../../core/container.js'
import {
  ExternalPartyCreateInputSchema,
  ExternalPartyIdParamSchema,
  ExternalPartyUpdateInputSchema,
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

    update: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = ExternalPartyIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = ExternalPartyUpdateInputSchema.parse(body)
      const updated = await container.externalPartiesService.update(
        id,
        input,
        getActorContext(c, user),
      )
      return c.json(updated)
    },

    delete: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = ExternalPartyIdParamSchema.parse({ id: c.req.param('id') })
      await container.externalPartiesService.hardDelete(id, getActorContext(c, user))
      return c.body(null, 204)
    },
  }
}
