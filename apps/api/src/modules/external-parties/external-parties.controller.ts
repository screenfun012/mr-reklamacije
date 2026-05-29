import type { Context } from 'hono'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import {
  ExternalPartyCreateInputSchema,
  ReferenceListQuerySchema,
} from './external-parties.validators.js'

function getActorContext(c: Context, user: MRSessionUser) {
  return {
    actorUserId: user.id,
    actorIp: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null,
    actorUserAgent: c.req.header('user-agent') ?? null,
  }
}

export function createExternalPartiesController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = ReferenceListQuerySchema.parse(c.req.query())
      const result = await container.externalPartiesService.list(query)
      return c.json(result)
    },

    create: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new Error('User must be authenticated')
      }

      const body: unknown = await c.req.json()
      const input = ExternalPartyCreateInputSchema.parse(body)
      const created = await container.externalPartiesService.create(input, getActorContext(c, user))
      return c.json(created, 201)
    },
  }
}
