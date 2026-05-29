import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { EmployeesListQuerySchema } from './employees.validators.js'

export function createEmployeesController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = EmployeesListQuerySchema.parse(c.req.query())
      const result = await container.employeesService.list(query)
      return c.json(result)
    },
  }
}
