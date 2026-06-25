import { ResourceChangedKey } from './resource-events.js'

/**
 * TanStack Query key prefixes to invalidate when a catalog resource changes via SSE.
 * Prefix match covers all filter variants (e.g. activeOnly true/false).
 */
export function queryKeyPrefixesForResourceChanged(
  resource: ResourceChangedKey,
): readonly (readonly string[])[] {
  switch (resource) {
    case ResourceChangedKey.EngineTypes:
      return [['engine-types']] as const
    default: {
      const _exhaustive: never = resource
      return _exhaustive
    }
  }
}
