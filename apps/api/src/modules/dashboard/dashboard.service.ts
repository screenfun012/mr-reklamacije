import { ForbiddenError } from '../../core/errors/domain-errors.js'
import type { DashboardRepository } from './dashboard.repository.js'
import type { DashboardActor, DashboardScope } from './dashboard.types.js'
import type { DashboardSummaryResponse } from './dashboard.validators.js'

function canViewEmotive(actor: DashboardActor): boolean {
  return (
    actor.permissions.includes('emotive_claims.view') ||
    actor.permissions.includes('emotive_claims.view_own_customer')
  )
}

function canViewDomace(actor: DashboardActor): boolean {
  return actor.permissions.includes('domace_claims.view')
}

function resolveScope(actor: DashboardActor): DashboardScope {
  const includeEmotive = canViewEmotive(actor)
  const includeDomace = canViewDomace(actor)

  if (!includeEmotive && !includeDomace) {
    throw new ForbiddenError()
  }

  return { includeEmotive, includeDomace }
}

export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  async getSummary(actor: DashboardActor): Promise<DashboardSummaryResponse> {
    const scope = resolveScope(actor)
    return this.repo.getSummary(scope)
  }
}
