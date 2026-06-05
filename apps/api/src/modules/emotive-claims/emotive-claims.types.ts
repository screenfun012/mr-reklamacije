export interface EmotiveClaimsActor {
  id: string
  permissions: readonly string[]
}

export type EmotiveClaimsListScope =
  | { type: 'all' }
  | { type: 'own_customer'; userId: string }

export interface EmotiveClaimsAuditContext {
  actorUserId: string
  actorIp?: string | null
  actorUserAgent?: string | null
}
