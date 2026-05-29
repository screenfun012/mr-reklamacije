import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { CustomersListQuerySchema } from './customers.validators.js'

export function createCustomersController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = CustomersListQuerySchema.parse(c.req.query())
      const result = await container.customersService.list(query)
      return c.json(result)
    },
  }
}
