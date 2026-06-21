export interface ClaimsActor {
  id: string
  permissions: readonly string[]
}

export type ClaimsListScope = {
  includeEmotive: boolean
  includeDomace: boolean
  emotiveCustomerScope: 'all' | 'own_customer'
  userId: string
}
