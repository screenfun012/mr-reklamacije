/** Catalog resource keys carried in SSE `resource_changed` payloads. */
export const ResourceChangedKey = {
  Customers: 'customers',
  EngineTypes: 'engineTypes',
} as const

export type ResourceChangedKey = (typeof ResourceChangedKey)[keyof typeof ResourceChangedKey]

export const ResourceEventType = {
  Changed: 'resource_changed',
} as const

export type ResourceEventType = (typeof ResourceEventType)[keyof typeof ResourceEventType]

export interface ResourceChangedPayload {
  resource: ResourceChangedKey
}
