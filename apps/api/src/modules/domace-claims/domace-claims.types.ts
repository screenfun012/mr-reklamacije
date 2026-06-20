export type { HttpActorContext as DomaceClaimsAuditContext } from '../../core/http/actor-context.js'

export interface DomaceClaimsActor {
  id: string
  permissions: readonly string[]
}

export type DomaceClaimsListScope = { type: 'all' } | { type: 'own_customer'; userId: string }
