export interface StatisticsActor {
  id: string
  permissions: readonly string[]
}

export interface StatisticsScope {
  includeEmotive: boolean
  includeDomace: boolean
}
