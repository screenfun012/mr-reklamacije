import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import {
  ClaimCategoryFieldCreateInputSchema,
  ClaimCategoryFieldIdParamSchema,
  ClaimCategoryFieldUpdateInputSchema,
  ClaimCategoryFieldsListQuerySchema,
} from './claim-category-fields.validators.js'

export function createClaimCategoryFieldsController(container: Container): {
  list: (c: Context) => Promise<Response>
  create: (c: Context) => Promise<Response>
  update: (c: Context) => Promise<Response>
  delete: (c: Context) => Promise<Response>
} {
  return {
    list: async (c: Context) => {
      const query = ClaimCategoryFieldsListQuerySchema.parse(c.req.query())
      const result = await container.claimCategoryFieldsService.list(query)
      return c.json(result)
    },

    create: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const body: unknown = await c.req.json()
      const input = ClaimCategoryFieldCreateInputSchema.parse(body)
      const created = await container.claimCategoryFieldsService.create(
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

      const { id } = ClaimCategoryFieldIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = ClaimCategoryFieldUpdateInputSchema.parse(body)
      const updated = await container.claimCategoryFieldsService.update(
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

      const { id } = ClaimCategoryFieldIdParamSchema.parse({ id: c.req.param('id') })
      await container.claimCategoryFieldsService.hardDelete(id, getActorContext(c, user))
      return c.body(null, 204)
    },
  }
}
