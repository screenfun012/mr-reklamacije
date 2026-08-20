import type { Context } from 'hono'

import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import type { Container } from '../../core/container.js'
import {
  ClaimCategoryCreateInputSchema,
  ClaimCategoryIdParamSchema,
  ClaimCategoryUpdateInputSchema,
  ReferenceListQuerySchema,
} from './claim-categories.validators.js'

export function createClaimCategoriesController(container: Container): {
  list: (c: Context) => Promise<Response>
  create: (c: Context) => Promise<Response>
  update: (c: Context) => Promise<Response>
  delete: (c: Context) => Promise<Response>
} {
  return {
    list: async (c: Context) => {
      const query = ReferenceListQuerySchema.parse(c.req.query())
      const result = await container.claimCategoriesService.list(query)
      return c.json(result)
    },

    create: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const body: unknown = await c.req.json()
      const input = ClaimCategoryCreateInputSchema.parse(body)
      const created = await container.claimCategoriesService.create(input, getActorContext(c, user))
      return c.json(created, 201)
    },

    update: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = ClaimCategoryIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = ClaimCategoryUpdateInputSchema.parse(body)
      const updated = await container.claimCategoriesService.update(
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

      const { id } = ClaimCategoryIdParamSchema.parse({ id: c.req.param('id') })
      await container.claimCategoriesService.hardDelete(id, getActorContext(c, user))
      return c.body(null, 204)
    },
  }
}
