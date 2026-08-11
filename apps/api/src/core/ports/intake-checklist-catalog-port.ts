/**
 * The slice of the intake checklist catalog the intake-orders service needs: which codes exist at
 * all. A core port so that module depends on core rather than a sibling module (depcruise
 * `no-sibling-modules`); the container injects the concrete `IntakeChecklistItemsRepository`.
 */
export interface IntakeChecklistCatalogPort {
  /**
   * Every code the catalog has ever held — deactivated and soft-deleted rows included. That is the
   * point: an order may already carry a code the shop has since retired, and refusing a correction
   * to such an order would make a signed document uncorrectable (plan D3).
   */
  listKnownCodes(): Promise<string[]>
}
