import { ClaimKind } from '@mr/shared'

import { ForbiddenError } from '../../core/errors/domain-errors.js'
import type { ClaimsRepository } from './claims.repository.js'
import type { ClaimsActor, ClaimsListScope } from './claims.types.js'
import type { ClaimListQuery, ClaimListResponse } from './claims.validators.js'

function canViewEmotive(actor: ClaimsActor): boolean {
  return (
    actor.permissions.includes('emotive_claims.view') ||
    actor.permissions.includes('emotive_claims.view_own_customer')
  )
}

function canViewDomace(actor: ClaimsActor): boolean {
  return actor.permissions.includes('domace_claims.view')
}

function resolveListScope(actor: ClaimsActor, query: ClaimListQuery): ClaimsListScope {
  const includeEmotive = canViewEmotive(actor)
  const includeDomace = canViewDomace(actor)

  if (query.kind === ClaimKind.Emotive && !includeEmotive) {
    throw new ForbiddenError()
  }

  if (query.kind === ClaimKind.Domace && !includeDomace) {
    throw new ForbiddenError()
  }

  if (!includeEmotive && !includeDomace) {
    throw new ForbiddenError()
  }

  const emotiveCustomerScope = actor.permissions.includes('emotive_claims.view')
    ? 'all'
    : 'own_customer'

  return {
    includeEmotive,
    includeDomace,
    emotiveCustomerScope,
    userId: actor.id,
  }
}

export class ClaimsService {
  constructor(private readonly repo: ClaimsRepository) {}

  async list(query: ClaimListQuery, actor: ClaimsActor): Promise<ClaimListResponse> {
    const scope = resolveListScope(actor, query)
    return this.repo.list(query, scope)
  }
}
