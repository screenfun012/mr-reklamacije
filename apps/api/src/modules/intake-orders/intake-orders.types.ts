export type { HttpActorContext as IntakeOrdersAuditContext } from '../../core/http/actor-context.js'

export interface IntakeOrdersActor {
  id: string
  permissions: readonly string[]
}

/**
 * `all` is the office: the whole shop, signed orders only unless it asks for the drafts.
 * `own` is a serviser: his own rows, drafts included — it is his own unfinished work and
 * hiding it would mean he could not resume from the list.
 */
export type IntakeOrdersListScope = { type: 'all' } | { type: 'own'; userId: string }
