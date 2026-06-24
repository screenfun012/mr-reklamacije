export interface DashboardActor {
  id: string
  permissions: readonly string[]
}

export interface DashboardScope {
  includeEmotive: boolean
  includeDomace: boolean
}
