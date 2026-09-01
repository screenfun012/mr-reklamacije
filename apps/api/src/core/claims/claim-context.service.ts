import { ClaimKind } from '@mr/shared'

import { ForbiddenError, NotFoundError } from '../errors/domain-errors.js'
import type {
  ClaimContext,
  ClaimContextActor,
  ClaimContextPort,
  DomaceClaimLookup,
  EmotiveClaimLookup,
} from '../ports/claim-context-port.js'

function resolveEmotiveScope(actor: ClaimContextActor) {
  if (actor.permissions.includes('emotive_claims.view')) {
    return { type: 'all' as const }
  }
  if (actor.permissions.includes('emotive_claims.view_own_customer')) {
    return { type: 'own_customer' as const, userId: actor.id }
  }
  throw new ForbiddenError()
}

function resolveDomaceScope(actor: ClaimContextActor) {
  if (actor.permissions.includes('domace_claims.view')) {
    return { type: 'all' as const }
  }
  if (actor.permissions.includes('domace_claims.view_own_customer')) {
    return { type: 'own_customer' as const, userId: actor.id }
  }
  throw new ForbiddenError()
}

export class ClaimContextService implements ClaimContextPort {
  constructor(
    private readonly emotiveClaims: EmotiveClaimLookup,
    private readonly domaceClaims: DomaceClaimLookup,
  ) {}

  async loadClaimContext(
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace,
    claimId: string,
    actor: ClaimContextActor,
  ): Promise<ClaimContext> {
    if (claimKind === ClaimKind.Emotive) {
      const scope = resolveEmotiveScope(actor)
      const claim = await this.emotiveClaims.findById(claimId, scope)
      if (claim === null) {
        throw new NotFoundError('International claim', claimId)
      }

      // A claim with neither timestamp set is "Primljeno" (received) — the
      // client's list still shows it as a masked card, but the client must not
      // be able to open its attachments/report. Existence-hiding: 404, not 403.
      if (
        scope.type === 'own_customer' &&
        claim.clientVisibleAt === null &&
        claim.publishedAt === null
      ) {
        throw new NotFoundError('International claim', claimId)
      }

      return { outcome: claim.outcome, claimYear: claim.claimYear }
    }

    const scope = resolveDomaceScope(actor)
    const claim = await this.domaceClaims.findById(claimId, scope)
    if (claim === null) {
      throw new NotFoundError('Domace claim', claimId)
    }

    return { outcome: claim.outcome, claimYear: claim.claimYear }
  }
}
