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
    // A renamed or retired category must reach the sidebar's counts and every claim list that
    // prints its name, not only the catalogue screens.
    case ResourceChangedKey.ClaimCategories:
      return [['claim-categories'], ['claims', 'category-counts']] as const
    case ResourceChangedKey.Users:
      return [['users']] as const
    // The list, the KPI cards and any open detail all live under this prefix.
    case ResourceChangedKey.IntakeOrders:
      return [['intake-orders']] as const
    // The wizard picker, the detail card and the print model all read the catalog through this
    // prefix, so a rename or a retired item reaches every open screen without a refresh.
    case ResourceChangedKey.IntakeChecklistItems:
      return [['intake-checklist-items']] as const
    default: {
      const _exhaustive: never = resource
      return _exhaustive
    }
  }
}
