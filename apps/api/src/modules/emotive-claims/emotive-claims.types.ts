export type { HttpActorContext as EmotiveClaimsAuditContext } from '../../core/http/actor-context.js'

export interface EmotiveClaimsActor {
  id: string
  permissions: readonly string[]
}

export type EmotiveClaimsListScope =
  | { type: 'all' }
  | { type: 'own_customer'; userId: string }
