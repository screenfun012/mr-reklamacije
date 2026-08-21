import { ClaimKind, type ClaimCategoryCountsResponse } from '@mr/shared'

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

/**
 * Which families and which rows the actor may read — the one gate both the list and the counts
 * use, so a badge can never count a claim its owner is not allowed to open.
 */
export function resolveViewScope(actor: ClaimsActor): ClaimsListScope {
  const includeEmotive = canViewEmotive(actor)
  const includeDomace = canViewDomace(actor)

  if (!includeEmotive && !includeDomace) {
    throw new ForbiddenError()
  }

  return {
    includeEmotive,
    includeDomace,
    emotiveCustomerScope: actor.permissions.includes('emotive_claims.view')
      ? 'all'
      : 'own_customer',
    userId: actor.id,
  }
}

function resolveListScope(actor: ClaimsActor, query: ClaimListQuery): ClaimsListScope {
  const scope = resolveViewScope(actor)

  if (query.kind === ClaimKind.Emotive && !scope.includeEmotive) {
    throw new ForbiddenError()
  }

  if (query.kind === ClaimKind.Domace && !scope.includeDomace) {
    throw new ForbiddenError()
  }

  return scope
}

export class ClaimsService {
  constructor(private readonly repo: ClaimsRepository) {}

  async list(query: ClaimListQuery, actor: ClaimsActor): Promise<ClaimListResponse> {
    return this.repo.list(query, resolveListScope(actor, query))
  }

  async categoryCounts(actor: ClaimsActor): Promise<ClaimCategoryCountsResponse> {
    return this.repo.categoryCounts(resolveViewScope(actor))
  }
}
