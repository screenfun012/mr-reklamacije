import type { EmotiveClaimCreateInput, EmotiveClaimDetail } from '@mr/shared'

import type { ApiClaimTxExecutor } from '../database.js'

export interface EmotiveClaimsConversionActor {
  readonly id: string
  readonly permissions: readonly string[]
}

/**
 * The slice of the EMOTIVE claims service the client-submissions conversion needs. A core
 * port so the domain module depends on core (not a sibling module — depcruise
 * `no-sibling-modules`); the container injects the concrete `EmotiveClaimsService`.
 */
export interface EmotiveClaimsConversionPort {
  /** Creates the claim inside a caller-owned transaction; returns the new claim id. */
  createWithinTransaction(
    tx: ApiClaimTxExecutor,
    input: EmotiveClaimCreateInput,
    actorUserId: string,
  ): Promise<string>

  /** Reads the created claim back (the conversion owns it via an all-scope view). */
  findById(id: string, actor: EmotiveClaimsConversionActor): Promise<EmotiveClaimDetail>
}
