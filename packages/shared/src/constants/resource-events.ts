/**
 * Resource keys carried in SSE `resource_changed` payloads — mostly catalogs, plus
 * `intakeOrders`, which reuses this signal rather than inventing an event type: the
 * requirement is identical (the office must see a car marked "Gotovo" without pressing
 * refresh) and the payload stays signal-only, carrying no row data.
 */
export const ResourceChangedKey = {
  Customers: 'customers',
  EngineTypes: 'engineTypes',
  EngineManufacturers: 'engineManufacturers',
  Departments: 'departments',
  Employees: 'employees',
  ExternalParties: 'externalParties',
  ClaimSources: 'claimSources',
  ClaimCategories: 'claimCategories',
  Users: 'users',
  IntakeOrders: 'intakeOrders',
  IntakeChecklistItems: 'intakeChecklistItems',
} as const

export type ResourceChangedKey = (typeof ResourceChangedKey)[keyof typeof ResourceChangedKey]

export const ResourceEventType = {
  Changed: 'resource_changed',
} as const

export type ResourceEventType = (typeof ResourceEventType)[keyof typeof ResourceEventType]

export interface ResourceChangedPayload {
  resource: ResourceChangedKey
}
