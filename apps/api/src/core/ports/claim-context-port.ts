import type { ClaimKind, ClaimOutcome } from '@mr/shared'

export interface ClaimContextActor {
  readonly id: string
  readonly permissions: readonly string[]
}

export interface ClaimContext {
  readonly outcome: ClaimOutcome
  readonly claimYear: number
}

export type EmotiveClaimLookupScope =
  | { readonly type: 'all' }
  | { readonly type: 'own_customer'; readonly userId: string }

export type DomaceClaimLookupScope =
  | { readonly type: 'all' }
  | { readonly type: 'own_customer'; readonly userId: string }

export interface EmotiveClaimLookup {
  findById(
    id: string,
    scope: EmotiveClaimLookupScope,
  ): Promise<{
    outcome: ClaimOutcome
    claimYear: number
    // Client-visibility lifecycle (Phase 2, EMOTIVE only) — lets loadClaimContext
    // 404 a "Primljeno" (private) claim for own_customer scope. See docs/claims.
    clientVisibleAt: string | null
    publishedAt: string | null
  } | null>
}

export interface DomaceClaimLookup {
  findById(
    id: string,
    scope: DomaceClaimLookupScope,
  ): Promise<{ outcome: ClaimOutcome; claimYear: number } | null>
}

export interface ClaimContextPort {
  loadClaimContext(
    claimKind: typeof ClaimKind.Emotive | typeof ClaimKind.Domace,
    claimId: string,
    actor: ClaimContextActor,
  ): Promise<ClaimContext>
}
