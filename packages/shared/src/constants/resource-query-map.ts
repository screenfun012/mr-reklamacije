import { ResourceChangedKey } from './resource-events.js'

/**
 * TanStack Query key prefixes to invalidate when a catalog resource changes via SSE.
 * Prefix match covers all filter variants (e.g. activeOnly true/false).
 */
export function queryKeyPrefixesForResourceChanged(
  resource: ResourceChangedKey,
): readonly (readonly string[])[] {
  switch (resource) {
    case ResourceChangedKey.Customers:
      return [['customers']] as const
    case ResourceChangedKey.EngineTypes:
      return [['engine-types']] as const
    // engine-types denormalize manufacturerName, so a manufacturer rename must
    // also refresh the engine-types list + its labelled dropdowns.
    case ResourceChangedKey.EngineManufacturers:
      return [['engine-manufacturers'], ['engine-types']] as const
    // employees denormalize departmentName, so a department rename must also
    // refresh the employees list + its labelled dropdowns.
    case ResourceChangedKey.Departments:
      return [['departments'], ['employees']] as const
    case ResourceChangedKey.Employees:
      return [['employees']] as const
    case ResourceChangedKey.ExternalParties:
      return [['external-parties']] as const
    case ResourceChangedKey.ClaimSources:
      return [['claim-sources']] as const
    case ResourceChangedKey.Users:
      return [['users']] as const
    default: {
      const _exhaustive: never = resource
      return _exhaustive
    }
  }
}
