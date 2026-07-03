import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import type { MRSessionUser } from '../../core/auth/session-types.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { DashboardActor } from './dashboard.types.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (!user) {
    throw new UnauthorizedError()
  }
  return user
}

function toActor(user: MRSessionUser): DashboardActor {
  return {
    id: user.id,
    permissions: user.permissions ?? [],
  }
}

export function createDashboardController(container: Container) {
  return {
    summary: async (c: Context) => {
      const user = requireUser(c)
      const result = await container.dashboardService.getSummary(toActor(user))
      return c.json(result)
    },

    clientSummary: async (c: Context) => {
      const user = requireUser(c)
      const result = await container.dashboardService.getClientSummary(toActor(user))
      return c.json(result)
    },
  }
}
