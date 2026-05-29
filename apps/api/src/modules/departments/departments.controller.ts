import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { ReferenceListQuerySchema } from './departments.validators.js'

export function createDepartmentsController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = ReferenceListQuerySchema.parse(c.req.query())
      const result = await container.departmentsService.list(query)
      return c.json(result)
    },
  }
}
