import type { Context } from 'hono'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { StatisticsActor } from './statistics.types.js'
import {
  StatisticsSummarySchema,
  statisticsFiltersFromSummaryQuery,
} from './statistics.validators.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

function toActor(user: MRSessionUser): StatisticsActor {
  return { id: user.id, permissions: user.permissions ?? [] }
}

export function createStatisticsController(container: Container): {
  summary: (c: Context) => Promise<Response>
} {
  return {
    summary: async (c: Context) => {
      const user = requireUser(c)
      const filters = statisticsFiltersFromSummaryQuery(c.req.query())
      const result = await container.statisticsService.getSummary(toActor(user), filters)
      return c.json(StatisticsSummarySchema.parse(result))
    },
  }
}
