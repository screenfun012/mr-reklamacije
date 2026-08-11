import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import {
  IntakeChecklistItemCreateInputSchema,
  IntakeChecklistItemIdParamSchema,
  IntakeChecklistItemsListQuerySchema,
  IntakeChecklistItemUpdateInputSchema,
} from './intake-checklist-items.validators.js'

export function createIntakeChecklistItemsController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = IntakeChecklistItemsListQuerySchema.parse(c.req.query())
      const result = await container.intakeChecklistItemsService.list(query)
      return c.json(result)
    },

    create: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const body: unknown = await c.req.json()
      const input = IntakeChecklistItemCreateInputSchema.parse(body)
      const created = await container.intakeChecklistItemsService.create(
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

      const { id } = IntakeChecklistItemIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = IntakeChecklistItemUpdateInputSchema.parse(body)
      const updated = await container.intakeChecklistItemsService.update(
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

      const { id } = IntakeChecklistItemIdParamSchema.parse({ id: c.req.param('id') })
      await container.intakeChecklistItemsService.softDelete(id, getActorContext(c, user))
      return c.body(null, 204)
    },
  }
}
