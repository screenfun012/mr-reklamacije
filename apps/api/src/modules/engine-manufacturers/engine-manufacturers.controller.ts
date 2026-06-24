import type { Context } from 'hono'

import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import type { Container } from '../../core/container.js'
import {
  EngineManufacturerCreateInputSchema,
  EngineManufacturerIdParamSchema,
  EngineManufacturerUpdateInputSchema,
  ReferenceListQuerySchema,
} from './engine-manufacturers.validators.js'

export function createEngineManufacturersController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = ReferenceListQuerySchema.parse(c.req.query())
      const result = await container.engineManufacturersService.list(query)
      return c.json(result)
    },

    create: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const body: unknown = await c.req.json()
      const input = EngineManufacturerCreateInputSchema.parse(body)
      const created = await container.engineManufacturersService.create(
        input,
        getActorContext(c, user),
      )
      return c.json(created, 201)
    },

    update: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = EngineManufacturerIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = EngineManufacturerUpdateInputSchema.parse(body)
      const updated = await container.engineManufacturersService.update(
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

      const { id } = EngineManufacturerIdParamSchema.parse({ id: c.req.param('id') })
      const deleted = await container.engineManufacturersService.softDelete(
        id,
        getActorContext(c, user),
      )
      return c.json(deleted)
    },
  }
}
