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
    case ResourceChangedKey.EngineManufacturers:
      return [['engine-manufacturers']] as const
    case ResourceChangedKey.Departments:
      return [['departments']] as const
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
