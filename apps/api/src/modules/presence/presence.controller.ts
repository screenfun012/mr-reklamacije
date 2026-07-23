import { PresenceTargetSchema } from '@mr/shared'
import type { Context } from 'hono'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

async function readTarget(c: Context) {
  return PresenceTargetSchema.parse(await c.req.json())
}

export function createPresenceController(container: Container) {
  return {
    heartbeat: async (c: Context) => {
      const user = requireUser(c)
      const target = await readTarget(c)
      const viewers = container.presenceService.heartbeat(target, {
        userId: user.id,
        // Name only — presence never reveals email, role or anything else.
        name: user.name,
      })
      return c.json({ viewers })
    },

    leave: async (c: Context) => {
      const user = requireUser(c)
      const target = await readTarget(c)
      container.presenceService.leave(target, user.id)
      return c.body(null, 204)
    },
  }
}
