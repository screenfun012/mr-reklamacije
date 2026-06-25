import type { Context } from 'hono'

import { getActorContext } from '../../core/http/actor-context.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { Container } from '../../core/container.js'
import {
  CustomerCreateInputSchema,
  CustomerIdParamSchema,
  CustomerUpdateInputSchema,
  CustomersListQuerySchema,
} from './customers.validators.js'

export function createCustomersController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = CustomersListQuerySchema.parse(c.req.query())
      const result = await container.customersService.list(query)
      return c.json(result)
    },

    create: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const body: unknown = await c.req.json()
      const input = CustomerCreateInputSchema.parse(body)
      const created = await container.customersService.create(input, getActorContext(c, user))
      return c.json(created, 201)
    },

    update: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = CustomerIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = CustomerUpdateInputSchema.parse(body)
      const updated = await container.customersService.update(id, input, getActorContext(c, user))
      return c.json(updated)
    },

    delete: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = CustomerIdParamSchema.parse({ id: c.req.param('id') })
      await container.customersService.hardDelete(id, getActorContext(c, user))
      return c.body(null, 204)
    },
  }
}
