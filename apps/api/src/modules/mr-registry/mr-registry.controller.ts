import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { MrRegistryLookupQuerySchema } from './mr-registry.validators.js'

export function createMrRegistryController(container: Container) {
  return {
    lookup: async (c: Context) => {
      const { mr } = MrRegistryLookupQuerySchema.parse(c.req.query())
      const existing = await container.mrRegistryService.findByMr(mr)
      return c.json(existing)
    },
  }
}
