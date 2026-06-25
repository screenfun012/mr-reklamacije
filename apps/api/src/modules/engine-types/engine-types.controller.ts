import type { Context } from 'hono'

import { getActorContext } from '../../core/http/actor-context.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { Container } from '../../core/container.js'
import {
  EngineTypeCreateInputSchema,
  EngineTypeIdParamSchema,
  EngineTypeUpdateInputSchema,
  ReferenceListQuerySchema,
} from './engine-types.validators.js'

export function createEngineTypesController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = ReferenceListQuerySchema.parse(c.req.query())
      const result = await container.engineTypesService.list(query)
      return c.json(result)
    },

    create: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const body: unknown = await c.req.json()
      const input = EngineTypeCreateInputSchema.parse(body)
      const created = await container.engineTypesService.create(input, getActorContext(c, user))
      return c.json(created, 201)
    },

    update: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = EngineTypeIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = EngineTypeUpdateInputSchema.parse(body)
      const updated = await container.engineTypesService.update(id, input, getActorContext(c, user))
      return c.json(updated)
    },

    delete: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = EngineTypeIdParamSchema.parse({ id: c.req.param('id') })
      await container.engineTypesService.hardDelete(id, getActorContext(c, user))
      return c.body(null, 204)
    },
  }
}
