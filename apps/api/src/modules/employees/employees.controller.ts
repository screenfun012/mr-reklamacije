import type { Context } from 'hono'

import { getActorContext } from '../../core/http/actor-context.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { Container } from '../../core/container.js'
import {
  EmployeeCreateInputSchema,
  EmployeeIdParamSchema,
  EmployeesListQuerySchema,
  EmployeeUpdateInputSchema,
} from './employees.validators.js'

export function createEmployeesController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = EmployeesListQuerySchema.parse(c.req.query())
      const result = await container.employeesService.list(query)
      return c.json(result)
    },

    create: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const body: unknown = await c.req.json()
      const input = EmployeeCreateInputSchema.parse(body)
      const created = await container.employeesService.create(input, getActorContext(c, user))
      return c.json(created, 201)
    },

    update: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = EmployeeIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = EmployeeUpdateInputSchema.parse(body)
      const updated = await container.employeesService.update(id, input, getActorContext(c, user))
      return c.json(updated)
    },

    delete: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = EmployeeIdParamSchema.parse({ id: c.req.param('id') })
      await container.employeesService.hardDelete(id, getActorContext(c, user))
      return c.body(null, 204)
    },
  }
}
