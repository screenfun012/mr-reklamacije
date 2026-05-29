import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { ReferenceListQuerySchema } from './claim-sources.validators.js'

export function createClaimSourcesController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = ReferenceListQuerySchema.parse(c.req.query())
      const result = await container.claimSourcesService.list(query)
      return c.json(result)
    },
  }
}
