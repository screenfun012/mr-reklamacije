import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import type { MRSessionUser } from '../../core/auth/session-types.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { ClaimListQuerySchema } from './claims.validators.js'
import type { ClaimsActor } from './claims.types.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (!user) {
    throw new UnauthorizedError()
  }
  return user
}

function toActor(user: MRSessionUser): ClaimsActor {
  return {
    id: user.id,
    permissions: user.permissions ?? [],
  }
}

export function createClaimsController(container: Container) {
  return {
    list: async (c: Context) => {
      const user = requireUser(c)
      const query = ClaimListQuerySchema.parse(c.req.query())
      const result = await container.claimsService.list(query, toActor(user))
      return c.json(result)
    },
  }
}
